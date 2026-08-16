import json
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

import pyotp
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import Settings
from app.core.security import decrypt_secret, encrypt_secret, hash_password, normalize_email, random_token, token_hash
from app.domains.identity.models import (
    AccountStatus,
    AccountStatusHistory,
    ActivationMethod,
    AuditLog,
    EmailOutbox,
    LoginHistory,
    Membership,
    MfaEnrollment,
    MfaRecoveryCode,
    OneTimeToken,
    Permission,
    PermissionCode,
    RequestThrottle,
    Role,
    RoleCode,
    Session,
    Tenant,
    User,
)


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def as_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


def stable_hash(value: str, secret: str) -> str:
    return token_hash(value or "unknown", secret)


def serialize_user(user: User) -> dict:
    memberships = [
        {"id": membership.tenant.id, "name": membership.tenant.name, "role": membership.role}
        for membership in user.memberships
        if membership.active
    ]
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "phone": user.phone,
        "timezone": user.timezone,
        "status": user.status,
        "activation_method": user.activation_method,
        "email_verified_at": user.email_verified_at,
        "admin_approved_at": user.admin_approved_at,
        "roles": [role.code for role in user.roles],
        "tenants": memberships,
    }


async def ensure_roles(db: AsyncSession) -> dict[RoleCode, Role]:
    existing = {
        role.code: role
        for role in (await db.scalars(select(Role).options(selectinload(Role.permissions)))).all()
    }
    for code, name in ((RoleCode.ADMIN, "Administrator"), (RoleCode.FARMER, "Farmer")):
        if code not in existing:
            existing[code] = Role(code=code, name=name, permissions=[])
            db.add(existing[code])
    await db.flush()
    permissions = {permission.code: permission for permission in (await db.scalars(select(Permission))).all()}
    for code, name in (
        (PermissionCode.USER_APPROVE, "Approve user accounts"),
        (PermissionCode.USER_MANAGE, "Manage user accounts"),
        (PermissionCode.TENANT_READ, "Read assigned tenant"),
    ):
        if code not in permissions:
            permissions[code] = Permission(code=code, name=name)
            db.add(permissions[code])
    await db.flush()
    existing[RoleCode.ADMIN].permissions = list(permissions.values())
    existing[RoleCode.FARMER].permissions = [permissions[PermissionCode.TENANT_READ]]
    return existing


async def bootstrap_admin(db: AsyncSession, settings: Settings) -> None:
    if not (settings.admin_email and settings.admin_password and settings.admin_mfa_secret):
        return
    email = normalize_email(settings.admin_email)
    if await db.scalar(select(User).where(User.email == email)):
        return
    roles = await ensure_roles(db)
    admin = User(
        email=email,
        full_name="DuriSense Administrator",
        password_hash=hash_password(settings.admin_password),
        status=AccountStatus.ACTIVE,
        email_verified_at=now_utc(),
        admin_approved_at=now_utc(),
        activation_method=ActivationMethod.ADMIN_APPROVAL,
        mfa_secret=encrypt_secret(settings.admin_mfa_secret, settings.secret_key),
        roles=[roles[RoleCode.ADMIN]],
    )
    db.add(admin)
    await db.commit()


async def check_throttle(db: AsyncSession, action: str, key: str, limit: int, minutes: int, settings: Settings) -> bool:
    cutoff = now_utc() - timedelta(minutes=minutes)
    key_digest = stable_hash(key, settings.secret_key)
    count = await db.scalar(select(func.count()).select_from(RequestThrottle).where(
        RequestThrottle.action == action,
        RequestThrottle.key_hash == key_digest,
        RequestThrottle.created_at >= cutoff,
    ))
    if (count or 0) >= limit:
        return False
    db.add(RequestThrottle(action=action, key_hash=key_digest, created_at=now_utc()))
    return True


async def issue_token(db: AsyncSession, user: User, purpose: str, minutes: int, settings: Settings) -> str:
    await db.execute(update(OneTimeToken).where(
        OneTimeToken.user_id == user.id,
        OneTimeToken.purpose == purpose,
        OneTimeToken.used_at.is_(None),
    ).values(used_at=now_utc()))
    plain = random_token()
    db.add(OneTimeToken(
        user_id=user.id,
        purpose=purpose,
        token_hash=token_hash(plain, settings.secret_key),
        created_at=now_utc(),
        expires_at=now_utc() + timedelta(minutes=minutes),
    ))
    return plain


async def consume_token(db: AsyncSession, plain: str, purpose: str, settings: Settings) -> tuple[OneTimeToken | None, str]:
    item = await db.scalar(select(OneTimeToken).where(
        OneTimeToken.token_hash == token_hash(plain, settings.secret_key),
        OneTimeToken.purpose == purpose,
    ))
    if item is None:
        return None, "invalid"
    if item.used_at is not None:
        return None, "used"
    if as_utc(item.expires_at) <= now_utc():
        return None, "expired"
    item.used_at = now_utc()
    return item, "valid"


async def create_session(db: AsyncSession, user: User, ip: str, user_agent: str, settings: Settings) -> tuple[str, str]:
    session_token = random_token()
    csrf_token = random_token()
    db.add(Session(
        token_hash=token_hash(session_token, settings.secret_key),
        csrf_hash=token_hash(csrf_token, settings.secret_key),
        user_id=user.id,
        created_at=now_utc(),
        expires_at=now_utc() + timedelta(minutes=settings.session_minutes),
        ip_hash=stable_hash(ip, settings.secret_key),
        user_agent=user_agent[:512],
    ))
    return session_token, csrf_token


async def record_login(db: AsyncSession, user: User | None, email: str, success: bool, reason: str, ip: str, settings: Settings) -> None:
    db.add(LoginHistory(
        user_id=user.id if user else None,
        email_hash=stable_hash(normalize_email(email), settings.secret_key),
        attempted_at=now_utc(),
        success=success,
        reason=reason,
        ip_hash=stable_hash(ip, settings.secret_key),
    ))


def verify_admin_totp(user: User, otp: str | None, settings: Settings) -> bool:
    if not any(role.code == RoleCode.ADMIN for role in user.roles):
        return True
    if not user.mfa_secret or not otp:
        return False
    try:
        secret = decrypt_secret(user.mfa_secret, settings.secret_key)
    except Exception:
        return False
    return pyotp.TOTP(secret).verify(otp, valid_window=1)


def recovery_code_hash(code: str, settings: Settings) -> str:
    return token_hash(code.replace("-", "").strip().upper(), settings.secret_key)


async def consume_recovery_code(db: AsyncSession, user: User, code: str | None, settings: Settings) -> bool:
    if not code:
        return False
    item = await db.scalar(select(MfaRecoveryCode).where(
        MfaRecoveryCode.user_id == user.id,
        MfaRecoveryCode.code_hash == recovery_code_hash(code, settings),
        MfaRecoveryCode.used_at.is_(None),
    ))
    if item is None:
        return False
    item.used_at = now_utc()
    return True


async def replace_recovery_codes(db: AsyncSession, user: User, settings: Settings) -> list[str]:
    await db.execute(update(MfaRecoveryCode).where(
        MfaRecoveryCode.user_id == user.id,
        MfaRecoveryCode.used_at.is_(None),
    ).values(used_at=now_utc()))
    codes = [f"{secrets.token_hex(3).upper()}-{secrets.token_hex(3).upper()}" for _ in range(8)]
    for code in codes:
        db.add(MfaRecoveryCode(
            user_id=user.id,
            code_hash=recovery_code_hash(code, settings),
            created_at=now_utc(),
        ))
    return codes


async def begin_mfa_enrollment(db: AsyncSession, user: User, settings: Settings) -> tuple[str, str, str]:
    await db.execute(update(MfaEnrollment).where(
        MfaEnrollment.user_id == user.id,
        MfaEnrollment.used_at.is_(None),
    ).values(used_at=now_utc()))
    secret = pyotp.random_base32()
    challenge = random_token()
    db.add(MfaEnrollment(
        user_id=user.id,
        token_hash=token_hash(challenge, settings.secret_key),
        secret_encrypted=encrypt_secret(secret, settings.secret_key),
        created_at=now_utc(),
        expires_at=now_utc() + timedelta(minutes=10),
    ))
    uri = pyotp.TOTP(secret).provisioning_uri(name=user.email, issuer_name="DuriSense")
    return challenge, secret, uri


async def confirm_mfa_enrollment(db: AsyncSession, user: User, challenge: str, otp: str, settings: Settings) -> list[str] | None:
    item = await db.scalar(select(MfaEnrollment).where(
        MfaEnrollment.user_id == user.id,
        MfaEnrollment.token_hash == token_hash(challenge, settings.secret_key),
        MfaEnrollment.used_at.is_(None),
    ))
    if item is None or as_utc(item.expires_at) <= now_utc():
        return None
    secret = decrypt_secret(item.secret_encrypted, settings.secret_key)
    if not pyotp.TOTP(secret).verify(otp, valid_window=1):
        return None
    item.used_at = now_utc()
    user.mfa_secret = encrypt_secret(secret, settings.secret_key)
    return await replace_recovery_codes(db, user, settings)


async def audit(db: AsyncSession, request_id: str, action: str, resource_type: str, resource_id: UUID | str | None, actor_id: UUID | None = None, tenant_id: UUID | None = None, detail: dict | None = None) -> None:
    db.add(AuditLog(
        actor_id=actor_id,
        tenant_id=tenant_id,
        action=action,
        resource_type=resource_type,
        resource_id=str(resource_id) if resource_id else None,
        detail=detail,
        request_id=request_id,
        created_at=now_utc(),
    ))


async def change_status(db: AsyncSession, user: User, target: AccountStatus, actor_id: UUID | None, reason: str | None, activation_method: ActivationMethod | None = None) -> None:
    allowed = {
        AccountStatus.PENDING_VERIFICATION: {AccountStatus.ACTIVE, AccountStatus.REJECTED, AccountStatus.SUSPENDED},
        AccountStatus.ACTIVE: {AccountStatus.SUSPENDED},
        AccountStatus.REJECTED: {AccountStatus.ACTIVE},
        AccountStatus.SUSPENDED: {AccountStatus.ACTIVE},
    }
    if target != user.status and target not in allowed[user.status]:
        raise ValueError("invalid account status transition")
    previous = user.status
    user.status = target
    if activation_method:
        user.activation_method = activation_method
    db.add(AccountStatusHistory(user_id=user.id, from_status=previous, to_status=target, actor_id=actor_id, reason=reason, created_at=now_utc()))


async def queue_email(db: AsyncSession, recipient: str, template: str, payload: dict, settings: Settings) -> None:
    encrypted = encrypt_secret(json.dumps(payload), settings.secret_key)
    db.add(EmailOutbox(
        recipient=recipient,
        template=template,
        payload={"encrypted": encrypted},
        created_at=now_utc(),
        next_attempt_at=now_utc(),
    ))
