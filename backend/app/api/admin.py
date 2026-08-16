from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import AuthContext, require_admin, require_admin_mutation
from app.api.errors import APIError
from app.db.session import get_db
from app.core.config import Settings, get_settings
from app.domains.identity.models import AccountStatus, ActivationMethod, RoleCode, Session, User
from app.domains.identity.schemas import AdminDecisionRequest, GenericResponse, PendingUserResponse, RoleAssignmentRequest
from app.domains.identity.service import audit, change_status, ensure_roles, now_utc, queue_email

router = APIRouter(prefix="/admin/users", tags=["Administration"])


@router.get("/pending", response_model=list[PendingUserResponse])
async def list_pending(
    _: AuthContext = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    users = (await db.scalars(select(User).where(User.status == AccountStatus.PENDING_VERIFICATION).order_by(User.created_at).limit(limit).offset(offset))).all()
    return users


@router.get("", response_model=list[PendingUserResponse])
async def list_users(
    _: AuthContext = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
    status: AccountStatus | None = None,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    query = select(User).order_by(User.created_at).limit(limit).offset(offset)
    if status:
        query = query.where(User.status == status)
    return (await db.scalars(query)).all()


async def get_target(user_id: UUID, db: AsyncSession) -> User:
    user = await db.scalar(select(User).where(User.id == user_id))
    if user is None:
        raise APIError(404, "USER_NOT_FOUND", "User was not found")
    return user


@router.post("/{user_id}/approve", response_model=GenericResponse)
async def approve_user(user_id: UUID, payload: AdminDecisionRequest, request: Request, auth: AuthContext = Depends(require_admin_mutation), db: AsyncSession = Depends(get_db), settings: Settings = Depends(get_settings)):
    user = await get_target(user_id, db)
    await change_status(db, user, AccountStatus.ACTIVE, auth.user.id, payload.reason, ActivationMethod.ADMIN_APPROVAL)
    user.admin_approved_at = now_utc()
    user.admin_approved_by = auth.user.id
    await queue_email(db, user.email, "account_activated", {"method": ActivationMethod.ADMIN_APPROVAL.value}, settings)
    await audit(db, request.state.request_id, "admin.user_approved", "user", user.id, actor_id=auth.user.id, detail={"reason": payload.reason})
    await db.commit()
    return GenericResponse(message="User approved")


@router.post("/{user_id}/reject", response_model=GenericResponse)
async def reject_user(user_id: UUID, payload: AdminDecisionRequest, request: Request, auth: AuthContext = Depends(require_admin_mutation), db: AsyncSession = Depends(get_db), settings: Settings = Depends(get_settings)):
    user = await get_target(user_id, db)
    if not payload.reason:
        raise APIError(422, "REASON_REQUIRED", "A rejection reason is required")
    await change_status(db, user, AccountStatus.REJECTED, auth.user.id, payload.reason)
    await db.execute(update(Session).where(Session.user_id == user.id, Session.revoked_at.is_(None)).values(revoked_at=now_utc()))
    await queue_email(db, user.email, "account_rejected", {"reason": payload.reason}, settings)
    await audit(db, request.state.request_id, "admin.user_rejected", "user", user.id, actor_id=auth.user.id, detail={"reason": payload.reason})
    await db.commit()
    return GenericResponse(message="User rejected")


@router.post("/{user_id}/suspend", response_model=GenericResponse)
async def suspend_user(user_id: UUID, payload: AdminDecisionRequest, request: Request, auth: AuthContext = Depends(require_admin_mutation), db: AsyncSession = Depends(get_db)):
    user = await get_target(user_id, db)
    if user.id == auth.user.id:
        raise APIError(409, "SELF_SUSPEND_FORBIDDEN", "Administrators cannot suspend their own active account")
    if not payload.reason:
        raise APIError(422, "REASON_REQUIRED", "A suspension reason is required")
    await change_status(db, user, AccountStatus.SUSPENDED, auth.user.id, payload.reason)
    await db.execute(update(Session).where(Session.user_id == user.id, Session.revoked_at.is_(None)).values(revoked_at=now_utc()))
    await audit(db, request.state.request_id, "admin.user_suspended", "user", user.id, actor_id=auth.user.id, detail={"reason": payload.reason})
    await db.commit()
    return GenericResponse(message="User suspended")


@router.put("/{user_id}/roles", response_model=GenericResponse)
async def assign_roles(user_id: UUID, payload: RoleAssignmentRequest, request: Request, auth: AuthContext = Depends(require_admin_mutation), db: AsyncSession = Depends(get_db)):
    user = await get_target(user_id, db)
    if user.id == auth.user.id:
        raise APIError(409, "SELF_ROLE_CHANGE_FORBIDDEN", "Administrators cannot change their own roles")
    roles = await ensure_roles(db)
    user.roles = [roles[code] for code in set(payload.roles)]
    await db.execute(update(Session).where(Session.user_id == user.id, Session.revoked_at.is_(None)).values(revoked_at=now_utc()))
    await audit(db, request.state.request_id, "admin.user_roles_changed", "user", user.id, actor_id=auth.user.id, detail={"roles": [code.value for code in payload.roles], "reason": payload.reason})
    await db.commit()
    return GenericResponse(message="User roles updated")
