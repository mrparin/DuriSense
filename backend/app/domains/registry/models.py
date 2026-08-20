import enum
from datetime import datetime
from uuid import UUID

from sqlalchemy import Boolean, CheckConstraint, DateTime, Enum, Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, IdMixin, TimestampMixin


class FarmStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    ARCHIVED = "ARCHIVED"


class FarmRole(str, enum.Enum):
    OWNER = "OWNER"
    MANAGER = "MANAGER"
    MEMBER = "MEMBER"
    TECHNICIAN = "TECHNICIAN"


class DeviceKind(str, enum.Enum):
    WEATHER_STATION = "WEATHER_STATION"
    SOIL_SENSOR = "SOIL_SENSOR"


class DeviceStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    DECOMMISSIONED = "DECOMMISSIONED"


class SoilSensorType(str, enum.Enum):
    SOIL_TH = "SOIL_TH"
    SOIL_7_IN_1 = "SOIL_7_IN_1"


class Farm(IdMixin, TimestampMixin, Base):
    __tablename__ = "farms"
    __table_args__ = (UniqueConstraint("tenant_id", "name"),)

    tenant_id: Mapped[UUID] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    timezone: Mapped[str] = mapped_column(String(64), default="Asia/Bangkok")
    province: Mapped[str | None] = mapped_column(String(100))
    district: Mapped[str | None] = mapped_column(String(100))
    subdistrict: Mapped[str | None] = mapped_column(String(100))
    status: Mapped[FarmStatus] = mapped_column(Enum(FarmStatus, native_enum=False), default=FarmStatus.ACTIVE, index=True)

    plots: Mapped[list["Plot"]] = relationship(back_populates="farm", lazy="selectin")


class FarmMembership(IdMixin, TimestampMixin, Base):
    __tablename__ = "farm_memberships"
    __table_args__ = (UniqueConstraint("farm_id", "user_id"),)

    tenant_id: Mapped[UUID] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"), index=True)
    farm_id: Mapped[UUID] = mapped_column(ForeignKey("farms.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    role: Mapped[FarmRole] = mapped_column(Enum(FarmRole, native_enum=False), default=FarmRole.MEMBER)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class Plot(IdMixin, TimestampMixin, Base):
    __tablename__ = "plots"
    __table_args__ = (
        UniqueConstraint("farm_id", "name"),
        CheckConstraint("area_rai IS NULL OR area_rai >= 0", name="area_rai_nonnegative"),
    )

    tenant_id: Mapped[UUID] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"), index=True)
    farm_id: Mapped[UUID] = mapped_column(ForeignKey("farms.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    area_rai: Mapped[float | None] = mapped_column(Float)
    crop_variety: Mapped[str | None] = mapped_column(String(120))
    notes: Mapped[str | None] = mapped_column(Text)
    active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)

    farm: Mapped[Farm] = relationship(back_populates="plots")


class Device(IdMixin, TimestampMixin, Base):
    __tablename__ = "devices"
    __table_args__ = (UniqueConstraint("tenant_id", "device_code"),)

    tenant_id: Mapped[UUID] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"), index=True)
    farm_id: Mapped[UUID] = mapped_column(ForeignKey("farms.id", ondelete="CASCADE"), index=True)
    plot_id: Mapped[UUID | None] = mapped_column(ForeignKey("plots.id", ondelete="SET NULL"), index=True)
    device_code: Mapped[str] = mapped_column(String(100))
    display_name: Mapped[str] = mapped_column(String(200))
    kind: Mapped[DeviceKind] = mapped_column(Enum(DeviceKind, native_enum=False), index=True)
    status: Mapped[DeviceStatus] = mapped_column(Enum(DeviceStatus, native_enum=False), default=DeviceStatus.ACTIVE, index=True)
    firmware_version: Mapped[str | None] = mapped_column(String(100))
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    weather_station: Mapped["WeatherStation | None"] = relationship(back_populates="device", lazy="joined", uselist=False)
    soil_sensor: Mapped["SoilSensor | None"] = relationship(back_populates="device", lazy="joined", uselist=False)


class WeatherStation(Base):
    __tablename__ = "weather_stations"

    device_id: Mapped[UUID] = mapped_column(ForeignKey("devices.id", ondelete="CASCADE"), primary_key=True)
    model: Mapped[str | None] = mapped_column(String(120))
    serial_number: Mapped[str | None] = mapped_column(String(120))

    device: Mapped[Device] = relationship(back_populates="weather_station")


class SoilSensor(Base):
    __tablename__ = "soil_sensors"
    __table_args__ = (CheckConstraint("modbus_address IS NULL OR (modbus_address >= 1 AND modbus_address <= 247)", name="modbus_address_range"),)

    device_id: Mapped[UUID] = mapped_column(ForeignKey("devices.id", ondelete="CASCADE"), primary_key=True)
    sensor_type: Mapped[SoilSensorType] = mapped_column(Enum(SoilSensorType, native_enum=False))
    modbus_address: Mapped[int | None] = mapped_column(Integer)

    device: Mapped[Device] = relationship(back_populates="soil_sensor")


class SensorAssignment(IdMixin, Base):
    __tablename__ = "sensor_assignments"
    __table_args__ = (
        CheckConstraint("valid_to IS NULL OR valid_to > valid_from", name="valid_time_order"),
        Index("ix_sensor_assignments_lookup", "sensor_id", "valid_from", "valid_to"),
    )

    tenant_id: Mapped[UUID] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"), index=True)
    farm_id: Mapped[UUID] = mapped_column(ForeignKey("farms.id", ondelete="CASCADE"), index=True)
    plot_id: Mapped[UUID] = mapped_column(ForeignKey("plots.id", ondelete="RESTRICT"), index=True)
    sensor_id: Mapped[UUID] = mapped_column(ForeignKey("soil_sensors.device_id", ondelete="RESTRICT"), index=True)
    station_id: Mapped[UUID] = mapped_column(ForeignKey("weather_stations.device_id", ondelete="RESTRICT"), index=True)
    valid_from: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    valid_to: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    installation_depth_cm: Mapped[float | None] = mapped_column(Float)
    installed_by: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    note: Mapped[str | None] = mapped_column(Text)


class DeviceCredential(IdMixin, Base):
    __tablename__ = "device_credentials"

    device_id: Mapped[UUID] = mapped_column(ForeignKey("devices.id", ondelete="CASCADE"), index=True)
    secret_hash: Mapped[str] = mapped_column(String(64), unique=True)
    issued_by: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)


class DecommissionRecord(IdMixin, Base):
    __tablename__ = "decommission_records"

    device_id: Mapped[UUID] = mapped_column(ForeignKey("devices.id", ondelete="RESTRICT"), index=True)
    actor_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    reason: Mapped[str] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
