from datetime import datetime
from uuid import UUID
from sqlalchemy import DateTime, Double, ForeignKey, Index, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, IdMixin, TimestampMixin


class SensorReading(IdMixin, TimestampMixin, Base):
    __tablename__ = "sensor_readings"

    tenant_id: Mapped[UUID] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"), index=True)
    farm_id: Mapped[UUID] = mapped_column(ForeignKey("farms.id", ondelete="CASCADE"), index=True)
    plot_id: Mapped[UUID | None] = mapped_column(ForeignKey("plots.id", ondelete="SET NULL"), index=True)
    station_id: Mapped[UUID] = mapped_column(ForeignKey("devices.id", ondelete="CASCADE"), index=True)
    sensor_id: Mapped[UUID | None] = mapped_column(ForeignKey("devices.id", ondelete="SET NULL"), index=True)

    publisher_type: Mapped[str] = mapped_column(String(32))  # WEATHER_STATION, SOIL_SENSOR
    sensor_type: Mapped[str | None] = mapped_column(String(32))  # WEATHER, SOIL_TH, SOIL_7_IN_1
    metric_key: Mapped[str] = mapped_column(String(64), index=True)  # air_temperature, soil_moisture, soil_ec, etc.

    raw_value: Mapped[float | None] = mapped_column(Double)
    normalized_value: Mapped[float | None] = mapped_column(Double)
    unit: Mapped[str] = mapped_column(String(32))
    quality: Mapped[str] = mapped_column(String(32), default="valid")  # valid, degraded, suspect, out_of_bounds, missing, error

    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    message_id: Mapped[str | None] = mapped_column(String(64), index=True)

    __table_args__ = (
        Index("ix_readings_station_metric_time", "tenant_id", "farm_id", "station_id", "metric_key", "observed_at"),
        Index("ix_readings_sensor_metric_time", "tenant_id", "farm_id", "sensor_id", "metric_key", "observed_at"),
        Index("ix_readings_plot_time", "tenant_id", "plot_id", "observed_at"),
    )


class DeviceHealthHistory(IdMixin, TimestampMixin, Base):
    __tablename__ = "device_health_history"

    tenant_id: Mapped[UUID] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"), index=True)
    station_id: Mapped[UUID] = mapped_column(ForeignKey("devices.id", ondelete="CASCADE"), index=True)

    battery_pct: Mapped[float | None] = mapped_column(Double)
    battery_voltage: Mapped[float | None] = mapped_column(Double)
    rssi_dbm: Mapped[int | None] = mapped_column(Integer)
    uptime_seconds: Mapped[int | None] = mapped_column(Integer)
    firmware_version: Mapped[str | None] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(32), default="ONLINE")  # ONLINE, OFFLINE, DEGRADED

    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)

    __table_args__ = (
        Index("ix_health_station_time", "tenant_id", "station_id", "recorded_at"),
    )


class RawMqttMessage(IdMixin, TimestampMixin, Base):
    __tablename__ = "raw_mqtt_messages"

    tenant_id: Mapped[UUID | None] = mapped_column(ForeignKey("tenants.id", ondelete="SET NULL"), index=True)
    station_id: Mapped[UUID | None] = mapped_column(ForeignKey("devices.id", ondelete="SET NULL"), index=True)

    topic: Mapped[str] = mapped_column(String(256), index=True)
    message_id: Mapped[str | None] = mapped_column(String(64), index=True)
    payload: Mapped[dict] = mapped_column(JSON)
    validation_status: Mapped[str] = mapped_column(String(32), index=True)  # VALID, QUARANTINED, DUPLICATE
    quarantine_reason: Mapped[str | None] = mapped_column(Text)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)

    __table_args__ = (
        Index("ix_raw_mqtt_status_time", "validation_status", "received_at"),
    )
