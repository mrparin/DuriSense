from datetime import datetime, timezone
import logging
from uuid import UUID

from sqlalchemy import and_, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.domains.alerts.models import (
    AlertEvent,
    AlertMetricType,
    AlertOperator,
    AlertRule,
    AlertSeverity,
    AlertState,
    NotificationPreference,
)
from app.domains.alerts.schemas import (
    AcknowledgeAlertRequest,
    AlertMetricsSummary,
    AlertEventResponse,
    AlertRuleCreate,
    AlertRuleResponse,
    AlertRuleUpdate,
    NotificationPreferenceResponse,
    NotificationPreferenceUpdate,
    ResolveAlertRequest,
)
from app.domains.identity.models import RoleCode, User
from app.domains.registry.models import Device, Farm, FarmMembership, Plot

logger = logging.getLogger("durisense-alerts")


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


async def check_farm_access(db: AsyncSession, farm_id: UUID, user: User) -> Farm | None:
    is_admin = any(role.code == RoleCode.ADMIN for role in user.roles)
    if is_admin:
        return await db.scalar(select(Farm).where(Farm.id == farm_id))

    membership = await db.scalar(
        select(FarmMembership).where(
            FarmMembership.farm_id == farm_id,
            FarmMembership.user_id == user.id,
        )
    )
    if not membership:
        return None

    return await db.scalar(select(Farm).where(Farm.id == farm_id))


# ==================== Alert Rules ====================

async def get_farm_alert_rules(db: AsyncSession, farm_id: UUID, user: User) -> list[AlertRuleResponse] | None:
    farm = await check_farm_access(db, farm_id, user)
    if not farm:
        return None

    rules = (await db.scalars(
        select(AlertRule)
        .where(AlertRule.farm_id == farm_id)
        .order_by(desc(AlertRule.created_at))
    )).all()

    return [AlertRuleResponse.model_validate(r) for r in rules]


async def create_farm_alert_rule(
    db: AsyncSession,
    farm_id: UUID,
    req: AlertRuleCreate,
    user: User,
) -> AlertRuleResponse | None:
    farm = await check_farm_access(db, farm_id, user)
    if not farm:
        return None

    rule = AlertRule(
        tenant_id=farm.tenant_id,
        farm_id=farm.id,
        plot_id=req.plot_id,
        station_id=req.station_id,
        name=req.name,
        metric_type=req.metric_type,
        operator=req.operator,
        threshold_min=req.threshold_min,
        threshold_max=req.threshold_max,
        duration_seconds=req.duration_seconds,
        hysteresis=req.hysteresis,
        severity=req.severity,
        is_active=req.is_active,
        notify_channels=req.notify_channels,
        created_by_id=user.id,
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return AlertRuleResponse.model_validate(rule)


async def update_farm_alert_rule(
    db: AsyncSession,
    farm_id: UUID,
    rule_id: UUID,
    req: AlertRuleUpdate,
    user: User,
) -> AlertRuleResponse | None:
    farm = await check_farm_access(db, farm_id, user)
    if not farm:
        return None

    rule = await db.scalar(
        select(AlertRule).where(
            AlertRule.id == rule_id,
            AlertRule.farm_id == farm_id,
        )
    )
    if not rule:
        return None

    if req.name is not None:
        rule.name = req.name
    if req.threshold_min is not None:
        rule.threshold_min = req.threshold_min
    if req.threshold_max is not None:
        rule.threshold_max = req.threshold_max
    if req.duration_seconds is not None:
        rule.duration_seconds = req.duration_seconds
    if req.hysteresis is not None:
        rule.hysteresis = req.hysteresis
    if req.severity is not None:
        rule.severity = req.severity
    if req.is_active is not None:
        rule.is_active = req.is_active
    if req.notify_channels is not None:
        rule.notify_channels = req.notify_channels
    if req.plot_id is not None:
        rule.plot_id = req.plot_id
    if req.station_id is not None:
        rule.station_id = req.station_id

    rule.updated_at = now_utc()
    await db.commit()
    await db.refresh(rule)
    return AlertRuleResponse.model_validate(rule)


async def delete_farm_alert_rule(
    db: AsyncSession,
    farm_id: UUID,
    rule_id: UUID,
    user: User,
) -> bool:
    farm = await check_farm_access(db, farm_id, user)
    if not farm:
        return False

    rule = await db.scalar(
        select(AlertRule).where(
            AlertRule.id == rule_id,
            AlertRule.farm_id == farm_id,
        )
    )
    if not rule:
        return False

    await db.delete(rule)
    await db.commit()
    return True


# ==================== Alert Events ====================

async def get_farm_alert_events(
    db: AsyncSession,
    farm_id: UUID,
    user: User,
    state: AlertState | None = None,
    limit: int = 50,
) -> list[AlertEventResponse] | None:
    farm = await check_farm_access(db, farm_id, user)
    if not farm:
        return None

    query = (
        select(AlertEvent)
        .where(AlertEvent.farm_id == farm_id)
        .order_by(desc(AlertEvent.created_at))
        .limit(limit)
    )
    if state:
        query = query.where(AlertEvent.state == state)

    events = (await db.scalars(query)).all()

    # Enrich rule names and acknowledged_by user names
    rule_ids = {e.rule_id for e in events}
    ack_user_ids = {e.acknowledged_by_id for e in events if e.acknowledged_by_id}

    rules = {}
    if rule_ids:
        r_list = (await db.scalars(select(AlertRule).where(AlertRule.id.in_(rule_ids)))).all()
        rules = {r.id: r.name for r in r_list}

    ack_users = {}
    if ack_user_ids:
        u_list = (await db.scalars(select(User).where(User.id.in_(ack_user_ids)))).all()
        ack_users = {u.id: u.full_name or u.email for u in u_list}

    res: list[AlertEventResponse] = []
    for e in events:
        res.append(AlertEventResponse(
            id=e.id,
            tenant_id=e.tenant_id,
            farm_id=e.farm_id,
            rule_id=e.rule_id,
            rule_name=rules.get(e.rule_id),
            station_id=e.station_id,
            plot_id=e.plot_id,
            severity=e.severity,
            state=e.state,
            triggered_value=e.triggered_value,
            title=e.title,
            message=e.message,
            acknowledged_by_id=e.acknowledged_by_id,
            acknowledged_by_name=ack_users.get(e.acknowledged_by_id) if e.acknowledged_by_id else None,
            acknowledged_at=e.acknowledged_at,
            acknowledge_note=e.acknowledge_note,
            resolved_at=e.resolved_at,
            resolve_reason=e.resolve_reason,
            created_at=e.created_at,
            updated_at=e.updated_at,
        ))

    return res


async def acknowledge_alert_event(
    db: AsyncSession,
    farm_id: UUID,
    event_id: UUID,
    req: AcknowledgeAlertRequest,
    user: User,
) -> AlertEventResponse | None:
    farm = await check_farm_access(db, farm_id, user)
    if not farm:
        return None

    event = await db.scalar(
        select(AlertEvent).where(
            AlertEvent.id == event_id,
            AlertEvent.farm_id == farm_id,
        )
    )
    if not event:
        return None

    now = now_utc()
    event.state = AlertState.ACKNOWLEDGED
    event.acknowledged_by_id = user.id
    event.acknowledged_at = now
    event.acknowledge_note = req.note
    event.updated_at = now

    await db.commit()
    await db.refresh(event)

    rule = await db.scalar(select(AlertRule).where(AlertRule.id == event.rule_id))
    return AlertEventResponse(
        id=event.id,
        tenant_id=event.tenant_id,
        farm_id=event.farm_id,
        rule_id=event.rule_id,
        rule_name=rule.name if rule else None,
        station_id=event.station_id,
        plot_id=event.plot_id,
        severity=event.severity,
        state=event.state,
        triggered_value=event.triggered_value,
        title=event.title,
        message=event.message,
        acknowledged_by_id=event.acknowledged_by_id,
        acknowledged_by_name=user.full_name or user.email,
        acknowledged_at=event.acknowledged_at,
        acknowledge_note=event.acknowledge_note,
        resolved_at=event.resolved_at,
        resolve_reason=event.resolve_reason,
        created_at=event.created_at,
        updated_at=event.updated_at,
    )


async def resolve_alert_event(
    db: AsyncSession,
    farm_id: UUID,
    event_id: UUID,
    req: ResolveAlertRequest,
    user: User,
) -> AlertEventResponse | None:
    farm = await check_farm_access(db, farm_id, user)
    if not farm:
        return None

    event = await db.scalar(
        select(AlertEvent).where(
            AlertEvent.id == event_id,
            AlertEvent.farm_id == farm_id,
        )
    )
    if not event:
        return None

    now = now_utc()
    event.state = AlertState.RESOLVED
    event.resolved_at = now
    event.resolve_reason = req.reason or "Resolved by user"
    event.updated_at = now

    await db.commit()
    await db.refresh(event)

    rule = await db.scalar(select(AlertRule).where(AlertRule.id == event.rule_id))
    return AlertEventResponse(
        id=event.id,
        tenant_id=event.tenant_id,
        farm_id=event.farm_id,
        rule_id=event.rule_id,
        rule_name=rule.name if rule else None,
        station_id=event.station_id,
        plot_id=event.plot_id,
        severity=event.severity,
        state=event.state,
        triggered_value=event.triggered_value,
        title=event.title,
        message=event.message,
        acknowledged_by_id=event.acknowledged_by_id,
        acknowledged_by_name=user.full_name or user.email if event.acknowledged_by_id else None,
        acknowledged_at=event.acknowledged_at,
        acknowledge_note=event.acknowledge_note,
        resolved_at=event.resolved_at,
        resolve_reason=event.resolve_reason,
        created_at=event.created_at,
        updated_at=event.updated_at,
    )


async def get_alert_metrics_summary(
    db: AsyncSession,
    farm_id: UUID,
    user: User,
) -> AlertMetricsSummary | None:
    farm = await check_farm_access(db, farm_id, user)
    if not farm:
        return None

    open_count = await db.scalar(
        select(func.count(AlertEvent.id)).where(
            AlertEvent.farm_id == farm_id,
            AlertEvent.state == AlertState.OPEN,
        )
    ) or 0

    ack_count = await db.scalar(
        select(func.count(AlertEvent.id)).where(
            AlertEvent.farm_id == farm_id,
            AlertEvent.state == AlertState.ACKNOWLEDGED,
        )
    ) or 0

    crit_count = await db.scalar(
        select(func.count(AlertEvent.id)).where(
            AlertEvent.farm_id == farm_id,
            AlertEvent.severity == AlertSeverity.CRITICAL,
            AlertEvent.state.in_([AlertState.OPEN, AlertState.ACKNOWLEDGED]),
        )
    ) or 0

    warn_count = await db.scalar(
        select(func.count(AlertEvent.id)).where(
            AlertEvent.farm_id == farm_id,
            AlertEvent.severity == AlertSeverity.WARNING,
            AlertEvent.state.in_([AlertState.OPEN, AlertState.ACKNOWLEDGED]),
        )
    ) or 0

    rules_count = await db.scalar(
        select(func.count(AlertRule.id)).where(
            AlertRule.farm_id == farm_id,
            AlertRule.is_active.is_(True),
        )
    ) or 0

    return AlertMetricsSummary(
        open_count=open_count,
        acknowledged_count=ack_count,
        critical_count=crit_count,
        warning_count=warn_count,
        active_rules_count=rules_count,
    )


# ==================== User Inbox & Preferences ====================

async def get_user_notification_inbox(
    db: AsyncSession,
    user: User,
    limit: int = 20,
) -> list[AlertEventResponse]:
    is_admin = any(role.code == RoleCode.ADMIN for role in user.roles)
    if is_admin:
        farm_ids = (await db.scalars(select(Farm.id))).all()
    else:
        farm_ids = (await db.scalars(
            select(FarmMembership.farm_id).where(FarmMembership.user_id == user.id)
        )).all()

    if not farm_ids:
        return []

    events = (await db.scalars(
        select(AlertEvent)
        .where(
            AlertEvent.farm_id.in_(farm_ids),
            AlertEvent.state.in_([AlertState.OPEN, AlertState.ACKNOWLEDGED]),
        )
        .order_by(desc(AlertEvent.created_at))
        .limit(limit)
    )).all()

    rule_ids = {e.rule_id for e in events}
    rules = {}
    if rule_ids:
        r_list = (await db.scalars(select(AlertRule).where(AlertRule.id.in_(rule_ids)))).all()
        rules = {r.id: r.name for r in r_list}

    res: list[AlertEventResponse] = []
    for e in events:
        res.append(AlertEventResponse(
            id=e.id,
            tenant_id=e.tenant_id,
            farm_id=e.farm_id,
            rule_id=e.rule_id,
            rule_name=rules.get(e.rule_id),
            station_id=e.station_id,
            plot_id=e.plot_id,
            severity=e.severity,
            state=e.state,
            triggered_value=e.triggered_value,
            title=e.title,
            message=e.message,
            acknowledged_by_id=e.acknowledged_by_id,
            acknowledged_by_name=None,
            acknowledged_at=e.acknowledged_at,
            acknowledge_note=e.acknowledge_note,
            resolved_at=e.resolved_at,
            resolve_reason=e.resolve_reason,
            created_at=e.created_at,
            updated_at=e.updated_at,
        ))
    return res


async def get_notification_preferences(
    db: AsyncSession,
    user: User,
) -> NotificationPreferenceResponse:
    pref = await db.scalar(select(NotificationPreference).where(NotificationPreference.user_id == user.id))
    if not pref:
        # Create default
        pref = NotificationPreference(
            user_id=user.id,
            tenant_id=user.tenant_id,
            email_enabled=True,
            in_app_enabled=True,
            quiet_hours_start=None,
            quiet_hours_end=None,
            min_severity=AlertSeverity.INFO,
        )
        db.add(pref)
        await db.commit()
        await db.refresh(pref)

    return NotificationPreferenceResponse.model_validate(pref)


async def update_notification_preferences(
    db: AsyncSession,
    user: User,
    req: NotificationPreferenceUpdate,
) -> NotificationPreferenceResponse:
    pref = await db.scalar(select(NotificationPreference).where(NotificationPreference.user_id == user.id))
    if not pref:
        pref = NotificationPreference(
            user_id=user.id,
            tenant_id=user.tenant_id,
            email_enabled=True if req.email_enabled is None else req.email_enabled,
            in_app_enabled=True if req.in_app_enabled is None else req.in_app_enabled,
            quiet_hours_start=req.quiet_hours_start,
            quiet_hours_end=req.quiet_hours_end,
            min_severity=req.min_severity or AlertSeverity.INFO,
        )
        db.add(pref)
    else:
        if req.email_enabled is not None:
            pref.email_enabled = req.email_enabled
        if req.in_app_enabled is not None:
            pref.in_app_enabled = req.in_app_enabled
        if req.quiet_hours_start is not None:
            pref.quiet_hours_start = req.quiet_hours_start
        if req.quiet_hours_end is not None:
            pref.quiet_hours_end = req.quiet_hours_end
        if req.min_severity is not None:
            pref.min_severity = req.min_severity
        pref.updated_at = now_utc()

    await db.commit()
    await db.refresh(pref)
    return NotificationPreferenceResponse.model_validate(pref)


# ==================== Evaluation Engine ====================

async def evaluate_sensor_value(
    db: AsyncSession,
    farm_id: UUID,
    metric_type: str,
    value: float,
    plot_id: UUID | None = None,
    station_id: UUID | None = None,
) -> list[AlertEvent]:
    """Evaluates incoming reading against active rules and triggers or resolves events."""
    rules = (await db.scalars(
        select(AlertRule).where(
            AlertRule.farm_id == farm_id,
            AlertRule.is_active.is_(True),
            AlertRule.metric_type == metric_type,
        )
    )).all()

    created_or_updated: list[AlertEvent] = []
    now = now_utc()

    for rule in rules:
        # Check plot/station match if specified
        if rule.plot_id and plot_id and rule.plot_id != plot_id:
            continue
        if rule.station_id and station_id and rule.station_id != station_id:
            continue

        violated = False
        if rule.operator == "LESS_THAN" and rule.threshold_min is not None:
            if value < rule.threshold_min:
                violated = True
        elif rule.operator == "GREATER_THAN" and rule.threshold_max is not None:
            if value > rule.threshold_max:
                violated = True
        elif rule.operator == "OUT_OF_RANGE":
            if (rule.threshold_min is not None and value < rule.threshold_min) or \
               (rule.threshold_max is not None and value > rule.threshold_max):
                violated = True

        existing_open = await db.scalar(
            select(AlertEvent).where(
                AlertEvent.rule_id == rule.id,
                AlertEvent.state.in_([AlertState.OPEN, AlertState.ACKNOWLEDGED]),
            )
        )

        if violated:
            if not existing_open:
                new_event = AlertEvent(
                    tenant_id=rule.tenant_id,
                    farm_id=rule.farm_id,
                    rule_id=rule.id,
                    station_id=station_id or rule.station_id,
                    plot_id=plot_id or rule.plot_id,
                    severity=rule.severity,
                    state=AlertState.OPEN,
                    triggered_value=value,
                    title=f"แจ้งเตือน: {rule.name}",
                    message=f"ตรวจพบค่า {metric_type} = {value:.1f} เกินขีดจำกัดที่กำหนดไว้ ({rule.operator})",
                    created_at=now,
                )
                db.add(new_event)
                created_or_updated.append(new_event)
        else:
            # Check hysteresis before auto-resolving
            if existing_open:
                within_hysteresis = False
                if rule.operator == "LESS_THAN" and rule.threshold_min is not None:
                    # Must be above threshold_min + hysteresis to resolve
                    if value >= (rule.threshold_min + rule.hysteresis):
                        within_hysteresis = True
                elif rule.operator == "GREATER_THAN" and rule.threshold_max is not None:
                    # Must be below threshold_max - hysteresis to resolve
                    if value <= (rule.threshold_max - rule.hysteresis):
                        within_hysteresis = True
                else:
                    within_hysteresis = True

                if within_hysteresis:
                    existing_open.state = AlertState.RESOLVED
                    existing_open.resolved_at = now
                    existing_open.resolve_reason = f"ค่าเซนเซอร์กลับสู่ภาวะปกติ ({value:.1f})"
                    existing_open.updated_at = now
                    created_or_updated.append(existing_open)

    if created_or_updated:
        await db.commit()

    return created_or_updated
