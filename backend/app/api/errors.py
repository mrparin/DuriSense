from fastapi import Request
from fastapi.responses import JSONResponse


class APIError(Exception):
    def __init__(self, status_code: int, code: str, message: str, field_errors: dict | None = None):
        self.status_code = status_code
        self.code = code
        self.message = message
        self.field_errors = field_errors


async def api_error_handler(request: Request, exc: APIError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "code": exc.code,
            "message": exc.message,
            "field_errors": exc.field_errors,
            "request_id": request.state.request_id,
        },
    )
