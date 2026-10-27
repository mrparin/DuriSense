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


class DeviceHealthHistoryItem(BaseModel):
    recorded_at: datetime
    battery_pct: float | None = None
    battery_voltage: float | None = None
    rssi_dbm: int | None = None
    status: str = "ONLINE"
    uptime_seconds: int | None = None


class DeviceHealthDetailResponse(BaseModel):
    device_id: UUID
    device_code: str
    display_name: str
    kind: str
    plot_id: UUID | None = None
    plot_name: str | None = None
    status: str = "ONLINE"  # ONLINE, DEGRADED, OFFLINE, UNKNOWN
    battery_pct: float | None = None
    battery_voltage: float | None = None
    battery_status: str = "GOOD"  # GOOD, FAIR, LOW, CRITICAL, UNKNOWN
    rssi_dbm: int | None = None
    signal_quality: str = "GOOD"  # EXCELLENT, GOOD, FAIR, POOR, UNKNOWN
    uptime_seconds: int | None = None
    uptime_formatted: str | None = None
    firmware_version: str | None = None
    last_seen: datetime | None = None
    offline_duration_seconds: float | None = None
    recent_history: list[DeviceHealthHistoryItem] = Field(default_factory=list)


class StationHealthSummary(BaseModel):
    station_id: UUID
    station_code: str
    display_name: str
    plot_id: UUID | None = None
    plot_name: str | None = None
    status: str = "ONLINE"
    battery_pct: float | None = None
    battery_status: str = "GOOD"
    rssi_dbm: int | None = None
    signal_quality: str = "GOOD"
    last_seen: datetime | None = None
    assigned_sensor_count: int = 0


class SensorHealthSummary(BaseModel):
    sensor_id: UUID
    sensor_code: str
    display_name: str
    sensor_type: str = "SOIL_7_IN_1"
    plot_id: UUID | None = None
    plot_name: str | None = None
    status: str = "ONLINE"
    last_seen: datetime | None = None


class FarmHealthSummaryResponse(BaseModel):
    farm_id: UUID
    total_stations: int = 0
    total_sensors: int = 0
    online_stations: int = 0
    degraded_stations: int = 0
    offline_stations: int = 0
    low_battery_count: int = 0
    weak_signal_count: int = 0
    stations: list[StationHealthSummary] = Field(default_factory=list)
    sensors: list[SensorHealthSummary] = Field(default_factory=list)


class DataGapItem(BaseModel):
    id: str
    station_id: UUID
    station_code: str
    station_name: str
    plot_name: str | None = None
    gap_start: datetime
    gap_end: datetime
    duration_seconds: float
    duration_formatted: str
    severity: str = "MINOR"  # MINOR, MODERATE, CRITICAL
    probable_cause: str = "ขาดการส่งข้อมูล (No Telemetry)"


class StationGapSummary(BaseModel):
    station_id: UUID
    station_code: str
    station_name: str
    total_gaps: int = 0
    total_gap_seconds: float = 0.0
    completeness_pct: float = 100.0


class DataGapReportResponse(BaseModel):
    farm_id: UUID
    start_date: datetime
    end_date: datetime
    threshold_minutes: int
    total_gaps_count: int = 0
    total_gap_duration_seconds: float = 0.0
    overall_completeness_pct: float = 100.0
    gaps: list[DataGapItem] = Field(default_factory=list)
    stations_summary: list[StationGapSummary] = Field(default_factory=list)


class OfflineCheckResult(BaseModel):
    checked_at: datetime
    total_devices_checked: int = 0
    offline_devices_count: int = 0
    offline_device_codes: list[str] = Field(default_factory=list)
    alerts_triggered: int = 0


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
