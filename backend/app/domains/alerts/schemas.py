from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.domains.alerts.models import AlertSeverity, AlertState


class AlertRuleCreate(BaseModel):
    name: str = Field(..., max_length=120)
    metric_type: str = Field(..., max_length=50)  # e.g., SOIL_MOISTURE, AIR_TEMP, OFFLINE_TIMEOUT
    operator: str = Field(..., max_length=30)     # e.g., GREATER_THAN, LESS_THAN, OUT_OF_RANGE, OFFLINE_TIMEOUT
    threshold_min: float | None = None
    threshold_max: float | None = None
    duration_seconds: int = Field(default=0, ge=0)
    hysteresis: float = Field(default=0.0, ge=0.0)
    severity: AlertSeverity = AlertSeverity.WARNING
    is_active: bool = True
    notify_channels: list[str] = Field(default=["IN_APP"])
    plot_id: UUID | None = None
    station_id: UUID | None = None


class AlertRuleUpdate(BaseModel):
    name: str | None = Field(None, max_length=120)
    threshold_min: float | None = None
    threshold_max: float | None = None
    duration_seconds: int | None = Field(None, ge=0)
    hysteresis: float | None = Field(None, ge=0.0)
    severity: AlertSeverity | None = None
    is_active: bool | None = None
    notify_channels: list[str] | None = None
    plot_id: UUID | None = None
    station_id: UUID | None = None


class AlertRuleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    farm_id: UUID
    plot_id: UUID | None
    station_id: UUID | None
    name: str
    metric_type: str
    operator: str
    threshold_min: float | None
    threshold_max: float | None
    duration_seconds: int
    hysteresis: float
    severity: AlertSeverity
    is_active: bool
    notify_channels: list[str]
    created_by_id: UUID | None
    created_at: datetime
    updated_at: datetime


class AlertEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    farm_id: UUID
    rule_id: UUID
    rule_name: str | None = None
    station_id: UUID | None = None
    plot_id: UUID | None = None
    severity: AlertSeverity
    state: AlertState
    triggered_value: float | None
    title: str
    message: str
    acknowledged_by_id: UUID | None
    acknowledged_by_name: str | None = None
    acknowledged_at: datetime | None
    acknowledge_note: str | None
    resolved_at: datetime | None
    resolve_reason: str | None
    created_at: datetime
    updated_at: datetime


class AcknowledgeAlertRequest(BaseModel):
    note: str | None = Field(None, max_length=500)


class ResolveAlertRequest(BaseModel):
    reason: str | None = Field(None, max_length=255)


class AlertMetricsSummary(BaseModel):
    open_count: int
    acknowledged_count: int
    critical_count: int
    warning_count: int
    active_rules_count: int


class NotificationPreferenceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    email_enabled: bool
    in_app_enabled: bool
    quiet_hours_start: str | None
    quiet_hours_end: str | None
    min_severity: AlertSeverity


class NotificationPreferenceUpdate(BaseModel):
    email_enabled: bool | None = None
    in_app_enabled: bool | None = None
    quiet_hours_start: str | None = None
    quiet_hours_end: str | None = None
    min_severity: AlertSeverity | None = None
