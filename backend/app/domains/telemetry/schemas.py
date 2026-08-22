from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field


class MetricValue(BaseModel):
    metric_key: str
    value: float | None = None
    raw_value: float | None = None
    unit: str
    quality: str = "valid"
    observed_at: datetime


class SensorTelemetrySummary(BaseModel):
    sensor_id: UUID
    sensor_code: str
    display_name: str
    sensor_type: str
    plot_id: UUID | None = None
    plot_name: str | None = None
    metrics: dict[str, MetricValue] = Field(default_factory=dict)
    last_seen: datetime | None = None


class StationTelemetrySummary(BaseModel):
    station_id: UUID
    station_code: str
    display_name: str
    plot_id: UUID | None = None
    plot_name: str | None = None
    status: str = "OFFLINE"
    battery_pct: float | None = None
    rssi_dbm: int | None = None
    last_seen: datetime | None = None
    metrics: dict[str, MetricValue] = Field(default_factory=dict)


class LatestTelemetryResponse(BaseModel):
    farm_id: UUID
    retrieved_at: datetime
    stations: list[StationTelemetrySummary] = Field(default_factory=list)
    sensors: list[SensorTelemetrySummary] = Field(default_factory=list)


class TimeSeriesPoint(BaseModel):
    timestamp: datetime
    value: float | None = None
    min_value: float | None = None
    max_value: float | None = None
    count: int = 1
    quality: str = "valid"


class TimeSeriesResponse(BaseModel):
    farm_id: UUID
    metric_key: str
    unit: str
    device_id: UUID | None = None
    interval: str = "raw"
    points: list[TimeSeriesPoint] = Field(default_factory=list)


class DeviceHealthResponse(BaseModel):
    device_id: UUID
    device_code: str
    display_name: str
    kind: str
    status: str
    battery_pct: float | None = None
    battery_voltage: float | None = None
    rssi_dbm: int | None = None
    uptime_seconds: int | None = None
    firmware_version: str | None = None
    last_seen: datetime | None = None


class QuarantineLogItem(BaseModel):
    id: UUID
    topic: str
    message_id: str | None = None
    quarantine_reason: str | None = None
    validation_status: str
    received_at: datetime


class AdminTelemetryOverview(BaseModel):
    active_stations_count: int
    online_stations_count: int
    total_readings_24h: int
    quarantined_messages_24h: int
    ingestion_rate_per_min: float
    recent_quarantine_logs: list[QuarantineLogItem] = Field(default_factory=list)
