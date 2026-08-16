import asyncio
from contextlib import asynccontextmanager, suppress
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse

from app.api import admin, auth, tenants
from app.api.errors import APIError, api_error_handler
from app.core.config import get_settings
from app.db.session import SessionLocal
from app.domains.identity.service import bootstrap_admin, ensure_roles
from app.services.email_delivery import email_worker

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    async with SessionLocal() as db:
        await ensure_roles(db)
        await db.commit()
        await bootstrap_admin(db, settings)
    worker = asyncio.create_task(email_worker(settings)) if settings.smtp_host else None
    try:
        yield
    finally:
        if worker:
            worker.cancel()
            with suppress(asyncio.CancelledError):
                await worker


app = FastAPI(
    title="DuriSense API",
    version="0.1.0",
    description="Identity, session, RBAC, and tenant isolation services for DuriSense.",
    lifespan=lifespan,
)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.allowed_hosts)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "X-CSRF-Token", "X-Request-ID"],
)


@app.middleware("http")
async def request_context(request: Request, call_next):
    request.state.request_id = request.headers.get("X-Request-ID") or str(uuid4())
    response = await call_next(request)
    response.headers["X-Request-ID"] = request.state.request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "same-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    return response


app.add_exception_handler(APIError, api_error_handler)


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    fields: dict[str, list[str]] = {}
    for item in exc.errors():
        field = ".".join(str(part) for part in item["loc"] if part != "body") or "request"
        fields.setdefault(field, []).append(item["msg"])
    return JSONResponse(status_code=422, content={
        "code": "VALIDATION_ERROR",
        "message": "Request validation failed",
        "field_errors": fields,
        "request_id": request.state.request_id,
    })


@app.get("/api/v1/health", tags=["Operations"])
async def health():
    return {"status": "ok"}


app.include_router(auth.router, prefix="/api/v1")
app.include_router(auth.users_router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(tenants.router, prefix="/api/v1")
