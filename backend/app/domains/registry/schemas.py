from datetime import datetime, timezone
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.domains.registry.models import DeviceKind, DeviceStatus, FarmRole, FarmStatus, SoilSensorType


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class FarmCreate(BaseModel):
    tenant_id: UUID
    name: str = Field(min_length=2, max_length=200)
    timezone: str = Field(default="Asia/Bangkok", max_length=64)
    province: str | None = Field(default=None, max_length=100)
    district: str | None = Field(default=None, max_length=100)
    subdistrict: str | None = Field(default=None, max_length=100)


class FarmUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=200)
    timezone: str | None = Field(default=None, max_length=64)
    province: str | None = Field(default=None, max_length=100)
    district: str | None = Field(default=None, max_length=100)
    subdistrict: str | None = Field(default=None, max_length=100)


class FarmResponse(ORMModel):
    id: UUID
    tenant_id: UUID
    name: str
    timezone: str
    province: str | None
    district: str | None
    subdistrict: str | None
    status: FarmStatus
    membership_role: FarmRole
    created_at: datetime


class FarmMembershipCreate(BaseModel):
    email: EmailStr
    role: FarmRole


class FarmMembershipUpdate(BaseModel):
    role: FarmRole


class FarmMembershipResponse(BaseModel):
    id: UUID
    farm_id: UUID
    user_id: UUID
    email: EmailStr
    full_name: str
    role: FarmRole
    active: bool
    created_at: datetime


class PlotCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    area_rai: float | None = Field(default=None, ge=0)
    crop_variety: str | None = Field(default=None, max_length=120)
    notes: str | None = Field(default=None, max_length=2000)


class PlotUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    area_rai: float | None = Field(default=None, ge=0)
    crop_variety: str | None = Field(default=None, max_length=120)
    notes: str | None = Field(default=None, max_length=2000)


class PlotResponse(ORMModel):
    id: UUID
    tenant_id: UUID
    farm_id: UUID
    name: str
    area_rai: float | None
    crop_variety: str | None
    notes: str | None
    active: bool
    created_at: datetime


class WeatherStationCreate(BaseModel):
    farm_id: UUID
    plot_id: UUID | None = None
    device_code: str = Field(min_length=2, max_length=100, pattern=r"^[A-Za-z0-9._-]+$")
    display_name: str = Field(min_length=2, max_length=200)
    firmware_version: str | None = Field(default=None, max_length=100)
    model: str | None = Field(default=None, max_length=120)
    serial_number: str | None = Field(default=None, max_length=120)


class SoilSensorCreate(BaseModel):
    farm_id: UUID
    plot_id: UUID | None = None
    device_code: str = Field(min_length=2, max_length=100, pattern=r"^[A-Za-z0-9._-]+$")
    display_name: str = Field(min_length=2, max_length=200)
    firmware_version: str | None = Field(default=None, max_length=100)
    sensor_type: SoilSensorType
    modbus_address: int | None = Field(default=None, ge=1, le=247)


class DeviceUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=2, max_length=200)
    plot_id: UUID | None = None
    firmware_version: str | None = Field(default=None, max_length=100)


class DeviceResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    farm_id: UUID
    plot_id: UUID | None
    device_code: str
    display_name: str
    kind: DeviceKind
    status: DeviceStatus
    firmware_version: str | None
    last_seen_at: datetime | None
    sensor_type: SoilSensorType | None = None
    modbus_address: int | None = None
    model: str | None = None
    serial_number: str | None = None
    created_at: datetime


class AssignmentCreate(BaseModel):
    sensor_id: UUID
    station_id: UUID
    plot_id: UUID
    valid_from: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    installation_depth_cm: float | None = Field(default=None, ge=0, le=500)
    note: str | None = Field(default=None, max_length=2000)


class AssignmentResponse(ORMModel):
    id: UUID
    tenant_id: UUID
    farm_id: UUID
    plot_id: UUID
    sensor_id: UUID
    station_id: UUID
    valid_from: datetime
    valid_to: datetime | None
    installation_depth_cm: float | None
    installed_by: UUID
    note: str | None


class CredentialResponse(BaseModel):
    credential_id: UUID
    device_id: UUID
    secret: str
    message: str


class DecommissionRequest(BaseModel):
    reason: str = Field(min_length=3, max_length=500)


class CalibrationCreate(BaseModel):
    calibrated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    formula_type: str | None = Field(default="LINEAR", max_length=50)
    offset_value: float | None = Field(default=0.0)
    scale_factor: float | None = Field(default=1.0)
    temperature_compensation: bool = False
    notes: str | None = Field(default=None, max_length=2000)


class CalibrationResponse(ORMModel):
    id: UUID
    tenant_id: UUID
    farm_id: UUID
    sensor_id: UUID
    operator_id: UUID
    calibrated_at: datetime
    formula_type: str | None
    offset_value: float | None
    scale_factor: float | None
    temperature_compensation: bool
    notes: str | None

