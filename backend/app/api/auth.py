from datetime import timedelta

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import AuthContext, csrf_protected, current_auth
from app.api.errors import APIError
from app.core.config import Settings, get_settings
from app.core.security import hash_password, normalize_email, verify_password
from app.db.session import get_db
from app.domains.identity.models import AccountStatus, ActivationMethod, Membership, OneTimeToken, RoleCode, Session, Tenant, User
from app.domains.identity.schemas import (
    AuthResponse,
    EmailRequest,
    GenericResponse,
    LoginRequest,
    MfaConfirmRequest,
    MfaRecoveryCodesRequest,
    MfaRecoveryCodesResponse,
    MfaSetupResponse,
    ProfileUpdate,
    RegisterRequest,
    RegistrationResponse,
    RegistrationStatusResponse,
    ResetPasswordRequest,
    TokenRequest,
    UserResponse,
)
from app.domains.identity.service import (
    as_utc,
    audit,
    begin_mfa_enrollment,
    change_status,
    check_throttle,
    consume_token,
    consume_recovery_code,
    confirm_mfa_enrollment,
    create_session,
    ensure_roles,
    issue_token,
    now_utc,
    queue_email,
    record_login,
    replace_recovery_codes,
    serialize_user,
    verify_admin_totp,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])
users_router = APIRouter(prefix="/users", tags=["Users"])


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def set_auth_cookies(response: Response, session_token: str, csrf_token: str, settings: Settings) -> None:
    response.set_cookie("durisense_session", session_token, httponly=True, secure=settings.cookie_secure, samesite="lax", max_age=settings.session_minutes * 60, path="/")
    response.set_cookie("durisense_csrf", csrf_token, httponly=False, secure=settings.cookie_secure, samesite="lax", max_age=settings.session_minutes * 60, path="/")


def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie("durisense_session", path="/")
    response.delete_cookie("durisense_csrf", path="/")


@router.post("/register", response_model=RegistrationResponse, status_code=201)
async def register(payload: RegisterRequest, request: Request, db: AsyncSession = Depends(get_db), settings: Settings = Depends(get_settings)):
    email = normalize_email(str(payload.email))
    if not await check_throttle(db, "register", f"{email}:{client_ip(request)}", 3, 60, settings):
        raise APIError(429, "RATE_LIMITED", "Too many registration attempts")
    if await db.scalar(select(User.id).where(User.email == email)):
        raise APIError(409, "REGISTRATION_UNAVAILABLE", "Registration cannot be completed with these details")
    roles = await ensure_roles(db)
    user = User(email=email, full_name=payload.full_name.strip(), phone=payload.phone, password_hash=hash_password(payload.password), roles=[roles[RoleCode.FARMER]])
    tenant = Tenant(name=payload.farm_name.strip())
    db.add_all([user, tenant])
    await db.flush()
    db.add(Membership(tenant_id=tenant.id, user_id=user.id, role=RoleCode.FARMER))
    verification = await issue_token(db, user, "VERIFY_EMAIL", settings.verification_minutes, settings)
    await queue_email(db, email, "verify_email", {"token": verification}, settings)
    await change_status(db, user, AccountStatus.PENDING_VERIFICATION, None, "registration")
    await audit(db, request.state.request_id, "identity.registered", "user", user.id, tenant_id=tenant.id)
    await db.commit()
    return RegistrationResponse(status=user.status, message="Registration received", verification_token=verification if settings.expose_dev_tokens else None)


@router.post("/verify-email", response_model=GenericResponse)
async def verify_email(payload: TokenRequest, request: Request, db: AsyncSession = Depends(get_db), settings: Settings = Depends(get_settings)):
    token, state = await consume_token(db, payload.token, "VERIFY_EMAIL", settings)
    if not token:
        raise APIError(400, f"TOKEN_{state.upper()}", f"Verification token is {state}")
    user = await db.scalar(select(User).where(User.id == token.user_id))
    if user is None:
        raise APIError(400, "TOKEN_INVALID", "Verification token is invalid")
    if user.status == AccountStatus.PENDING_VERIFICATION:
        await change_status(db, user, AccountStatus.ACTIVE, user.id, "email verified", ActivationMethod.EMAIL_LINK)
    user.email_verified_at = user.email_verified_at or now_utc()
    await queue_email(db, user.email, "account_activated", {"method": ActivationMethod.EMAIL_LINK.value}, settings)
    await audit(db, request.state.request_id, "identity.email_verified", "user", user.id, actor_id=user.id)
    await db.commit()
    return GenericResponse(message="Email verified and account activated")


@router.post("/resend-verification", response_model=GenericResponse)
async def resend_verification(payload: EmailRequest, request: Request, db: AsyncSession = Depends(get_db), settings: Settings = Depends(get_settings)):
    email = normalize_email(str(payload.email))
    if not await check_throttle(db, "resend", f"{email}:{client_ip(request)}", 3, 60, settings):
        raise APIError(429, "RATE_LIMITED", "Too many requests")
    user = await db.scalar(select(User).where(User.email == email))
    development_token = None
    if user and user.status == AccountStatus.PENDING_VERIFICATION:
        development_token = await issue_token(db, user, "VERIFY_EMAIL", settings.verification_minutes, settings)
        await queue_email(db, email, "verify_email", {"token": development_token}, settings)
    await db.commit()
    return GenericResponse(message="If the account is eligible, a verification message will be sent", development_token=development_token if settings.expose_dev_tokens else None)


@router.post("/registration-status", response_model=RegistrationStatusResponse)
async def registration_status(payload: EmailRequest, request: Request, db: AsyncSession = Depends(get_db), settings: Settings = Depends(get_settings)):
    email = normalize_email(str(payload.email))
    if not await check_throttle(db, "registration_status", f"{email}:{client_ip(request)}", 5, 60, settings):
        raise APIError(429, "RATE_LIMITED", "Too many requests")
    user = await db.scalar(select(User).where(User.email == email))
    if user:
        await queue_email(db, email, "registration_status", {"status": user.status.value}, settings)
    await db.commit()
    return RegistrationStatusResponse(status=user.status if settings.expose_dev_tokens and user else None, message="If this email is registered, its status will be sent")


@router.post("/login", response_model=AuthResponse)
async def login(payload: LoginRequest, request: Request, response: Response, db: AsyncSession = Depends(get_db), settings: Settings = Depends(get_settings)):
    email = normalize_email(str(payload.email))
    user = await db.scalar(select(User).where(User.email == email))
    ip = client_ip(request)
    if not await check_throttle(db, "login", f"{email}:{ip}", 10, settings.lockout_minutes, settings):
        await db.commit()
        raise APIError(429, "RATE_LIMITED", "Too many login attempts")
    if not user or not verify_password(user.password_hash, payload.password):
        if user:
            user.failed_login_count += 1
            if user.failed_login_count >= settings.login_attempts:
                user.locked_until = now_utc() + timedelta(minutes=settings.lockout_minutes)
        await record_login(db, user, email, False, "INVALID_CREDENTIALS", ip, settings)
        await db.commit()
        raise APIError(401, "INVALID_CREDENTIALS", "Email or password is incorrect")
    if user.locked_until and as_utc(user.locked_until) > now_utc():
        await record_login(db, user, email, False, "LOCKED", ip, settings)
        await db.commit()
        raise APIError(429, "ACCOUNT_LOCKED", "Account is temporarily locked")
    if user.status != AccountStatus.ACTIVE:
        await record_login(db, user, email, False, user.status.value, ip, settings)
        await db.commit()
        raise APIError(403, f"ACCOUNT_{user.status.value}", "Account is not available for login")
    is_admin = any(role.code == RoleCode.ADMIN for role in user.roles)
    mfa_valid = verify_admin_totp(user, payload.otp, settings)
    if is_admin and not mfa_valid:
        mfa_valid = await consume_recovery_code(db, user, payload.recovery_code, settings)
    if not mfa_valid:
        await record_login(db, user, email, False, "MFA_INVALID", ip, settings)
        await db.commit()
        raise APIError(401, "MFA_REQUIRED", "A valid administrator MFA code is required")
    user.failed_login_count = 0
    user.locked_until = None
    session_token, csrf_token = await create_session(db, user, ip, request.headers.get("user-agent", ""), settings)
    await record_login(db, user, email, True, "SUCCESS", ip, settings)
    await audit(db, request.state.request_id, "identity.login", "session", None, actor_id=user.id)
    await db.commit()
    set_auth_cookies(response, session_token, csrf_token, settings)
    return AuthResponse(user=serialize_user(user), csrf_token=csrf_token)


@router.get("/session", response_model=UserResponse)
async def read_session(auth: AuthContext = Depends(current_auth)):
    return serialize_user(auth.user)


@router.post("/session/refresh", response_model=AuthResponse)
async def refresh_session(request: Request, response: Response, auth: AuthContext = Depends(csrf_protected), db: AsyncSession = Depends(get_db), settings: Settings = Depends(get_settings)):
    auth.session.revoked_at = now_utc()
    session_token, csrf_token = await create_session(db, auth.user, client_ip(request), request.headers.get("user-agent", ""), settings)
    await audit(db, request.state.request_id, "identity.session_rotated", "session", auth.session.id, actor_id=auth.user.id)
    await db.commit()
    set_auth_cookies(response, session_token, csrf_token, settings)
    return AuthResponse(user=serialize_user(auth.user), csrf_token=csrf_token)


@router.post("/logout", response_model=GenericResponse)
async def logout(request: Request, response: Response, auth: AuthContext = Depends(csrf_protected), db: AsyncSession = Depends(get_db)):
    auth.session.revoked_at = now_utc()
    await audit(db, request.state.request_id, "identity.logout", "session", auth.session.id, actor_id=auth.user.id)
    await db.commit()
    clear_auth_cookies(response)
    return GenericResponse(message="Logged out")


@router.post("/password/forgot", response_model=GenericResponse)
async def forgot_password(payload: EmailRequest, request: Request, db: AsyncSession = Depends(get_db), settings: Settings = Depends(get_settings)):
    email = normalize_email(str(payload.email))
    if not await check_throttle(db, "forgot", f"{email}:{client_ip(request)}", 3, 60, settings):
        raise APIError(429, "RATE_LIMITED", "Too many requests")
    user = await db.scalar(select(User).where(User.email == email))
    development_token = None
    if user:
        development_token = await issue_token(db, user, "RESET_PASSWORD", settings.reset_minutes, settings)
        await queue_email(db, email, "reset_password", {"token": development_token}, settings)
    await db.commit()
    return GenericResponse(message="If the email is registered, password reset instructions will be sent", development_token=development_token if settings.expose_dev_tokens else None)


@router.post("/password/reset", response_model=GenericResponse)
async def reset_password(payload: ResetPasswordRequest, request: Request, db: AsyncSession = Depends(get_db), settings: Settings = Depends(get_settings)):
    token, state = await consume_token(db, payload.token, "RESET_PASSWORD", settings)
    if not token:
        raise APIError(400, f"TOKEN_{state.upper()}", f"Reset token is {state}")
    user = await db.scalar(select(User).where(User.id == token.user_id))
    if user is None:
        raise APIError(400, "TOKEN_INVALID", "Reset token is invalid")
    user.password_hash = hash_password(payload.password)
    user.failed_login_count = 0
    user.locked_until = None
    await db.execute(update(Session).where(Session.user_id == user.id, Session.revoked_at.is_(None)).values(revoked_at=now_utc()))
    await audit(db, request.state.request_id, "identity.password_reset", "user", user.id, actor_id=user.id)
    await queue_email(db, user.email, "password_changed", {}, settings)
    await db.commit()
    return GenericResponse(message="Password reset completed")


@users_router.get("/me", response_model=UserResponse)
async def read_profile(auth: AuthContext = Depends(current_auth)):
    return serialize_user(auth.user)


@users_router.patch("/me", response_model=UserResponse)
async def update_profile(payload: ProfileUpdate, request: Request, auth: AuthContext = Depends(csrf_protected), db: AsyncSession = Depends(get_db)):
    auth.user.full_name = payload.full_name.strip()
    auth.user.phone = payload.phone
    auth.user.timezone = payload.timezone
    await audit(db, request.state.request_id, "identity.profile_updated", "user", auth.user.id, actor_id=auth.user.id)
    await db.commit()
    return serialize_user(auth.user)


@router.post("/mfa/setup", response_model=MfaSetupResponse)
async def setup_mfa(auth: AuthContext = Depends(csrf_protected), db: AsyncSession = Depends(get_db), settings: Settings = Depends(get_settings)):
    if not any(role.code == RoleCode.ADMIN for role in auth.user.roles):
        raise APIError(403, "ADMIN_REQUIRED", "Administrator access is required")
    challenge, secret, uri = await begin_mfa_enrollment(db, auth.user, settings)
    await db.commit()
    return MfaSetupResponse(challenge_token=challenge, secret=secret, provisioning_uri=uri)


@router.post("/mfa/confirm", response_model=MfaRecoveryCodesResponse)
async def confirm_mfa(payload: MfaConfirmRequest, request: Request, auth: AuthContext = Depends(csrf_protected), db: AsyncSession = Depends(get_db), settings: Settings = Depends(get_settings)):
    codes = await confirm_mfa_enrollment(db, auth.user, payload.challenge_token, payload.otp, settings)
    if codes is None:
        raise APIError(400, "MFA_SETUP_INVALID", "MFA setup code is invalid or expired")
    await db.execute(update(Session).where(Session.user_id == auth.user.id, Session.id != auth.session.id, Session.revoked_at.is_(None)).values(revoked_at=now_utc()))
    await audit(db, request.state.request_id, "identity.mfa_rotated", "user", auth.user.id, actor_id=auth.user.id)
    await db.commit()
    return MfaRecoveryCodesResponse(recovery_codes=codes)


@router.post("/mfa/recovery-codes", response_model=MfaRecoveryCodesResponse)
async def rotate_recovery_codes(payload: MfaRecoveryCodesRequest, request: Request, auth: AuthContext = Depends(csrf_protected), db: AsyncSession = Depends(get_db), settings: Settings = Depends(get_settings)):
    if not verify_admin_totp(auth.user, payload.otp, settings):
        raise APIError(400, "MFA_INVALID", "A valid MFA code is required")
    codes = await replace_recovery_codes(db, auth.user, settings)
    await audit(db, request.state.request_id, "identity.mfa_recovery_codes_rotated", "user", auth.user.id, actor_id=auth.user.id)
    await db.commit()
    return MfaRecoveryCodesResponse(recovery_codes=codes)
