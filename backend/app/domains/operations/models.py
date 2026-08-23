from datetime import datetime, timezone
import enum
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


class RelayCommandState(str, enum.Enum):
    PENDING = "PENDING"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    FAILED = "FAILED"
    TIMEOUT = "TIMEOUT"
    EXPIRED = "EXPIRED"
    STATE_MISMATCH = "STATE_MISMATCH"


class ActivityType(str, enum.Enum):
    IRRIGATION = "IRRIGATION"
    FERTILIZATION = "FERTILIZATION"
    PESTICIDE = "PESTICIDE"
    PRUNING = "PRUNING"
    HARVEST = "HARVEST"
    OTHER = "OTHER"


class RelayChannel(Base):
    __tablename__ = "relay_channels"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    tenant_id: Mapped[UUID] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    farm_id: Mapped[UUID] = mapped_column(ForeignKey("farms.id", ondelete="CASCADE"), nullable=False, index=True)
    plot_id: Mapped[UUID | None] = mapped_column(ForeignKey("plots.id", ondelete="SET NULL"), nullable=True, index=True)
    station_id: Mapped[UUID] = mapped_column(ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True)

    channel_number: Mapped[int] = mapped_column(Integer, nullable=False)  # 1, 2, 3, 4
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g., ปั๊มน้ำหลัก, วาล์วโซน 1
    gpio_pin: Mapped[int | None] = mapped_column(Integer, nullable=True)  # e.g., 26, 27, 25, 18
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)

    desired_state: Mapped[str] = mapped_column(String(10), nullable=False, default="OFF")  # ON / OFF
    reported_state: Mapped[str] = mapped_column(String(10), nullable=False, default="OFF")  # ON / OFF
    last_command_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_ack_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)

    commands: Mapped[list["RelayCommand"]] = relationship("RelayCommand", back_populates="channel", cascade="all, delete-orphan")


class RelayCommand(Base):
    __tablename__ = "relay_commands"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    tenant_id: Mapped[UUID] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    farm_id: Mapped[UUID] = mapped_column(ForeignKey("farms.id", ondelete="CASCADE"), nullable=False, index=True)
    channel_id: Mapped[UUID] = mapped_column(ForeignKey("relay_channels.id", ondelete="CASCADE"), nullable=False, index=True)
    issued_by_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    target_state: Mapped[str] = mapped_column(String(10), nullable=False)  # ON / OFF
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)  # Pulse duration
    state: Mapped[RelayCommandState] = mapped_column(Enum(RelayCommandState), nullable=False, default=RelayCommandState.PENDING)
    failure_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    channel: Mapped["RelayChannel"] = relationship("RelayChannel", back_populates="commands")
    events: Mapped[list["RelayCommandEvent"]] = relationship("RelayCommandEvent", back_populates="command", cascade="all, delete-orphan")


class RelayCommandEvent(Base):
    __tablename__ = "relay_command_events"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    command_id: Mapped[UUID] = mapped_column(ForeignKey("relay_commands.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)  # ISSUED, DISPATCHED, ACKNOWLEDGED, TIMEOUT, FAILED
    details: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)

    command: Mapped["RelayCommand"] = relationship("RelayCommand", back_populates="events")


class FarmActivity(Base):
    __tablename__ = "farm_activities"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    tenant_id: Mapped[UUID] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    farm_id: Mapped[UUID] = mapped_column(ForeignKey("farms.id", ondelete="CASCADE"), nullable=False, index=True)
    plot_id: Mapped[UUID | None] = mapped_column(ForeignKey("plots.id", ondelete="SET NULL"), nullable=True, index=True)
    recorded_by_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    activity_type: Mapped[ActivityType] = mapped_column(Enum(ActivityType), nullable=False)
    title: Mapped[str] = mapped_column(String(150), nullable=False)  # e.g., ให้น้ำแปลง ZoneA 30 นาที, ใส่ปุ๋ยสูตร 8-24-24
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    performed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)

    # Specific operational data
    volume_liters: Mapped[float | None] = mapped_column(nullable=True)  # ปริมาณน้ำ (ลิตร)
    product_name: Mapped[str | None] = mapped_column(String(150), nullable=True)  # ชื่อปุ๋ย/สารเคมี
    amount_kg: Mapped[float | None] = mapped_column(nullable=True)  # ปริมาณปุ๋ย (กก.)
    harvest_weight_kg: Mapped[float | None] = mapped_column(nullable=True)  # ผลผลิตที่เก็บเกี่ยวได้ (กก.)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)
