from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.domains.operations.models import ActivityType, RelayCommandState


class RelayChannelResponse(BaseModel):
    id: UUID
    farm_id: UUID
    plot_id: UUID | None
    plot_name: str | None
    station_id: UUID
    station_code: str
    channel_number: int
    display_name: str
    gpio_pin: int | None
    description: str | None
    desired_state: str
    reported_state: str
    last_command_at: datetime | None
    last_ack_at: datetime | None

    class Config:
        from_attributes = True


class DispatchRelayCommandRequest(BaseModel):
    target_state: str = Field(..., pattern="^(ON|OFF)$")
    duration_seconds: int | None = Field(default=None, ge=1, le=86400)  # max 24 hrs


class RelayCommandResponse(BaseModel):
    id: UUID
    channel_id: UUID
    issued_by_id: UUID
    target_state: str
    duration_seconds: int | None
    state: RelayCommandState
    failure_reason: str | None
    created_at: datetime
    acknowledged_at: datetime | None

    class Config:
        from_attributes = True


class FarmActivityCreate(BaseModel):
    plot_id: UUID | None = None
    activity_type: ActivityType
    title: str = Field(..., min_length=2, max_length=150)
    description: str | None = None
    performed_at: datetime | None = None
    volume_liters: float | None = Field(default=None, ge=0)
    product_name: str | None = Field(default=None, max_length=150)
    amount_kg: float | None = Field(default=None, ge=0)
    harvest_weight_kg: float | None = Field(default=None, ge=0)


class FarmActivityResponse(BaseModel):
    id: UUID
    farm_id: UUID
    plot_id: UUID | None
    plot_name: str | None
    recorded_by_id: UUID
    recorded_by_name: str
    activity_type: ActivityType
    title: str
    description: str | None
    performed_at: datetime
    volume_liters: float | None
    product_name: str | None
    amount_kg: float | None
    harvest_weight_kg: float | None
    created_at: datetime

    class Config:
        from_attributes = True
