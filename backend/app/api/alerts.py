from uuid import UUID

from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import AuthContext, current_auth
from app.api.errors import APIError
from app.db.session import get_db
from app.domains.alerts import service
from app.domains.alerts.models import AlertState
from app.domains.alerts.schemas import (
    AcknowledgeAlertRequest,
    AlertEventResponse,
    AlertMetricsSummary,
    AlertRuleCreate,
    AlertRuleResponse,
    AlertRuleUpdate,
    NotificationPreferenceResponse,
    NotificationPreferenceUpdate,
    ResolveAlertRequest,
)

router = APIRouter(tags=["Alerts & Notifications"])


# ==================== Alert Rules ====================

@router.get("/farms/{farm_id}/alerts/rules", response_model=list[AlertRuleResponse])
async def list_alert_rules(
    farm_id: UUID = Path(...),
    db: AsyncSession = Depends(get_db),
    auth: AuthContext = Depends(current_auth),
):
    rules = await service.get_farm_alert_rules(db, farm_id, auth.user)
    if rules is None:
        raise APIError(404, "FARM_NOT_FOUND", "Farm not found or access denied")
    return rules


@router.post("/farms/{farm_id}/alerts/rules", response_model=AlertRuleResponse, status_code=201)
async def create_alert_rule(
    farm_id: UUID = Path(...),
    req: AlertRuleCreate = ...,
    db: AsyncSession = Depends(get_db),
    auth: AuthContext = Depends(current_auth),
):
    rule = await service.create_farm_alert_rule(db, farm_id, req, auth.user)
    if rule is None:
        raise APIError(404, "FARM_NOT_FOUND", "Farm not found or access denied")
    return rule


@router.put("/farms/{farm_id}/alerts/rules/{rule_id}", response_model=AlertRuleResponse)
async def update_alert_rule(
    farm_id: UUID = Path(...),
    rule_id: UUID = Path(...),
    req: AlertRuleUpdate = ...,
    db: AsyncSession = Depends(get_db),
    auth: AuthContext = Depends(current_auth),
):
    rule = await service.update_farm_alert_rule(db, farm_id, rule_id, req, auth.user)
    if rule is None:
        raise APIError(404, "ALERT_RULE_NOT_FOUND", "Alert rule not found or access denied")
    return rule


@router.delete("/farms/{farm_id}/alerts/rules/{rule_id}", status_code=204)
async def delete_alert_rule(
    farm_id: UUID = Path(...),
    rule_id: UUID = Path(...),
    db: AsyncSession = Depends(get_db),
    auth: AuthContext = Depends(current_auth),
):
    success = await service.delete_farm_alert_rule(db, farm_id, rule_id, auth.user)
    if not success:
        raise APIError(404, "ALERT_RULE_NOT_FOUND", "Alert rule not found or access denied")
    return None


# ==================== Alert Events ====================

@router.get("/farms/{farm_id}/alerts/events", response_model=list[AlertEventResponse])
async def list_alert_events(
    farm_id: UUID = Path(...),
    state: AlertState | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    auth: AuthContext = Depends(current_auth),
):
    events = await service.get_farm_alert_events(db, farm_id, auth.user, state=state, limit=limit)
    if events is None:
        raise APIError(404, "FARM_NOT_FOUND", "Farm not found or access denied")
    return events


@router.post("/farms/{farm_id}/alerts/events/{event_id}/acknowledge", response_model=AlertEventResponse)
async def acknowledge_event(
    farm_id: UUID = Path(...),
    event_id: UUID = Path(...),
    req: AcknowledgeAlertRequest = ...,
    db: AsyncSession = Depends(get_db),
    auth: AuthContext = Depends(current_auth),
):
    event = await service.acknowledge_alert_event(db, farm_id, event_id, req, auth.user)
    if event is None:
        raise APIError(404, "ALERT_EVENT_NOT_FOUND", "Alert event not found or access denied")
    return event


@router.post("/farms/{farm_id}/alerts/events/{event_id}/resolve", response_model=AlertEventResponse)
async def resolve_event(
    farm_id: UUID = Path(...),
    event_id: UUID = Path(...),
    req: ResolveAlertRequest = ...,
    db: AsyncSession = Depends(get_db),
    auth: AuthContext = Depends(current_auth),
):
    event = await service.resolve_alert_event(db, farm_id, event_id, req, auth.user)
    if event is None:
        raise APIError(404, "ALERT_EVENT_NOT_FOUND", "Alert event not found or access denied")
    return event


@router.get("/farms/{farm_id}/alerts/summary", response_model=AlertMetricsSummary)
async def get_alerts_summary(
    farm_id: UUID = Path(...),
    db: AsyncSession = Depends(get_db),
    auth: AuthContext = Depends(current_auth),
):
    summary = await service.get_alert_metrics_summary(db, farm_id, auth.user)
    if summary is None:
        raise APIError(404, "FARM_NOT_FOUND", "Farm not found or access denied")
    return summary


# ==================== User Notifications ====================

@router.get("/notifications/inbox", response_model=list[AlertEventResponse])
async def get_notification_inbox(
    limit: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    auth: AuthContext = Depends(current_auth),
):
    return await service.get_user_notification_inbox(db, auth.user, limit=limit)


@router.get("/notifications/preferences", response_model=NotificationPreferenceResponse)
async def get_my_preferences(
    db: AsyncSession = Depends(get_db),
    auth: AuthContext = Depends(current_auth),
):
    return await service.get_notification_preferences(db, auth.user)


@router.put("/notifications/preferences", response_model=NotificationPreferenceResponse)
async def update_my_preferences(
    req: NotificationPreferenceUpdate = ...,
    db: AsyncSession = Depends(get_db),
    auth: AuthContext = Depends(current_auth),
):
    return await service.update_notification_preferences(db, auth.user, req)
