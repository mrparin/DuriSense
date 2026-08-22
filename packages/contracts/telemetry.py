from datetime import datetime
from enum import StrEnum
from typing import Any, Literal
from uuid import UUID
from pydantic import BaseModel, Field


class QualityFlag(StrEnum):
    VALID = "valid"
    DEGRADED = "degraded"
    SUSPECT = "suspect"
    CALCULATED = "calculated"
    OUT_OF_BOUNDS = "out_of_bounds"
    ERROR = "error"
    MISSING = "missing"


class ReadingItem(BaseModel):
    value: float | None = None
    unit: str
    quality: QualityFlag = QualityFlag.VALID
    raw_value: float | None = None
    note: str | None = None


class BaseTelemetryPayload(BaseModel):
    schema_version: str = "2.0"
    message_id: str = Field(..., min_length=8, max_length=64)
    station_id: str
    plot_id: str | None = None
    sequence: int | None = None
    observed_at: datetime


class WeatherPayloadV2(BaseTelemetryPayload):
    readings: dict[str, ReadingItem] = Field(
        ...,
        description="Air temperature, relative humidity, wind speed/direction, illuminance, rain, etc.",
    )


class SoilPayloadV2(BaseTelemetryPayload):
    sensor_id: str
    sensor_type: Literal["SOIL_TH", "SOIL_7_IN_1"] = "SOIL_7_IN_1"
    readings: dict[str, ReadingItem] = Field(
        ...,
        description="Soil temperature, moisture, EC, pH, N, P, K",
    )


class DeviceStatusPayload(BaseModel):
    schema_version: str = "2.0"
    message_id: str = Field(..., min_length=8, max_length=64)
    station_id: str
    observed_at: datetime
    battery_pct: float | None = Field(default=None, ge=0.0, le=100.0)
    battery_voltage: float | None = None
    rssi_dbm: int | None = None
    uptime_seconds: int | None = None
    firmware_version: str | None = None
    reboot_reason: str | None = None
    status: str = "ONLINE"


# Metric validation limits according to agronomy standards
METRIC_RANGE_LIMITS: dict[str, tuple[float, float, str]] = {
    # metric_key: (min_value, max_value, default_unit)
    "air_temperature": (-10.0, 60.0, "degC"),
    "air_relative_humidity": (0.0, 100.0, "%RH"),
    "wind_speed_avg_5m": (0.0, 60.0, "m/s"),
    "wind_direction_deg": (0.0, 360.0, "degree"),
    "illuminance": (0.0, 200000.0, "lux"),
    "solar_radiation": (0.0, 1500.0, "W/m2"),
    "rain_accumulation": (0.0, 500.0, "mm"),
    "soil_temperature": (-10.0, 60.0, "degC"),
    "soil_moisture": (0.0, 100.0, "%"),
    "soil_ec": (0.0, 20000.0, "uS/cm"),
    "soil_ph": (0.0, 14.0, "pH"),
    "soil_n": (0.0, 2000.0, "mg/kg"),
    "soil_p": (0.0, 2000.0, "mg/kg"),
    "soil_k": (0.0, 2000.0, "mg/kg"),
}
