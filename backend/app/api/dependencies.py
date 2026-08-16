from dataclasses import dataclass
from datetime import datetime, timezone
from uuid import UUID

from fastapi import Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.errors import APIError
from app.core.config import Settings, get_settings
from app.core.security import token_hash
from app.db.session import get_db
from app.domains.identity.models import AccountStatus, Membership, PermissionCode, RoleCode, Session, User


@dataclass
class AuthContext:
    user: User
    session: Session


async def current_auth(
    request: Request,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> AuthContext:
    plain = request.cookies.get("durisense_session")
    if not plain:
        raise APIError(401, "AUTH_REQUIRED", "Authentication is required")
    session = await db.scalar(select(Session).where(Session.token_hash == token_hash(plain, settings.secret_key)))
    now = datetime.now(timezone.utc)
    expires_at = session.expires_at.replace(tzinfo=timezone.utc) if session and session.expires_at.tzinfo is None else session.expires_at if session else None
    if session is None or session.revoked_at is not None or expires_at <= now:
        raise APIError(401, "SESSION_INVALID", "Session is invalid or expired")
    user = await db.scalar(select(User).where(User.id == session.user_id))
    if user is None or user.status != AccountStatus.ACTIVE:
        raise APIError(403, "ACCOUNT_UNAVAILABLE", "Account is not available")
    return AuthContext(user=user, session=session)


async def csrf_protected(
    request: Request,
    auth: AuthContext = Depends(current_auth),
    settings: Settings = Depends(get_settings),
) -> AuthContext:
    header = request.headers.get("X-CSRF-Token")
    cookie = request.cookies.get("durisense_csrf")
    origin = request.headers.get("Origin")
    if origin and origin not in settings.allowed_origins:
        raise APIError(403, "ORIGIN_REJECTED", "Request origin is not allowed")
    if not header or not cookie or header != cookie or token_hash(header, settings.secret_key) != auth.session.csrf_hash:
        raise APIError(403, "CSRF_INVALID", "CSRF token is missing or invalid")
    return auth


async def require_admin(auth: AuthContext = Depends(current_auth)) -> AuthContext:
    is_admin = any(role.code == RoleCode.ADMIN for role in auth.user.roles)
    permissions = {permission.code for role in auth.user.roles for permission in role.permissions}
    if not is_admin or PermissionCode.USER_MANAGE not in permissions:
        raise APIError(403, "ADMIN_REQUIRED", "Administrator permission is required")
    return auth


async def require_admin_mutation(auth: AuthContext = Depends(csrf_protected)) -> AuthContext:
    is_admin = any(role.code == RoleCode.ADMIN for role in auth.user.roles)
    permissions = {permission.code for role in auth.user.roles for permission in role.permissions}
    if not is_admin or PermissionCode.USER_APPROVE not in permissions:
        raise APIError(403, "ADMIN_REQUIRED", "Administrator permission is required")
    return auth


async def tenant_membership(
    tenant_id: UUID,
    auth: AuthContext = Depends(current_auth),
    db: AsyncSession = Depends(get_db),
) -> Membership:
    membership = await db.scalar(select(Membership).where(
        Membership.tenant_id == tenant_id,
        Membership.user_id == auth.user.id,
        Membership.active.is_(True),
    ))
    if membership is None:
        raise APIError(404, "RESOURCE_NOT_FOUND", "Resource was not found")
    return membership
