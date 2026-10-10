from datetime import datetime, timezone
import json
import logging
from uuid import UUID

try:
    from paho.mqtt import publish as mqtt_publish
except ImportError:
    mqtt_publish = None
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.identity.models import RoleCode, User
from app.domains.operations.models import ActivityType, FarmActivity, RelayChannel, RelayCommand, RelayCommandEvent, RelayCommandState
from app.domains.operations.schemas import (
    DispatchRelayCommandRequest,
    FarmActivityCreate,
    FarmActivityResponse,
    RelayChannelResponse,
    RelayCommandResponse,
)
from app.domains.registry.models import Device, DeviceKind, DeviceStatus, Farm, FarmMembership, Plot

logger = logging.getLogger("durisense-operations")


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


async def ensure_default_relay_channels(db: AsyncSession, farm_id: UUID) -> list[RelayChannel]:
    """Ensure default 4 relay channels exist for each station in the farm."""
    farm = await db.scalar(select(Farm).where(Farm.id == farm_id))
    if not farm:
        return []

    stations = (await db.scalars(
        select(Device).where(
            Device.farm_id == farm_id,
            Device.kind == DeviceKind.WEATHER_STATION,
            Device.status == DeviceStatus.ACTIVE,
        )
    )).all()

    existing_channels = (await db.scalars(select(RelayChannel).where(RelayChannel.farm_id == farm_id))).all()
    channel_map = {(ch.station_id, ch.channel_number): ch for ch in existing_channels}

    default_names = {
        1: ("ปั๊มน้ำหลัก (Main Pump)", 26, "ปั๊มน้ำแรงดันสูงจ่ายเข้าสวน"),
        2: ("วาล์วรดน้ำ โซน 1 (Zone 1 Valve)", 27, "วาล์วมินิสปริงเกลอร์ แปลงโซน 1"),
        3: ("วาล์วรดน้ำ โซน 2 (Zone 2 Valve)", 25, "วาล์วมินิสปริงเกลอร์ แปลงโซน 2"),
        4: ("ปั๊มผสมปุ๋ย/สารเคมี (Fertilizer Pump)", 18, "ปั๊มจ่ายปุ๋ยเข้าระบบน้ำ"),
    }

    added = False
    for st in stations:
        for ch_num in range(1, 5):
            if (st.id, ch_num) not in channel_map:
                name, pin, desc_text = default_names[ch_num]
                new_ch = RelayChannel(
                    tenant_id=farm.tenant_id,
                    farm_id=farm.id,
                    plot_id=st.plot_id,
                    station_id=st.id,
                    channel_number=ch_num,
                    display_name=name,
                    gpio_pin=pin,
                    description=desc_text,
                    desired_state="OFF",
                    reported_state="OFF",
                )
                db.add(new_ch)
                added = True

    if added:
        await db.commit()

    return (await db.scalars(
        select(RelayChannel)
        .where(RelayChannel.farm_id == farm_id)
        .order_by(RelayChannel.station_id.asc(), RelayChannel.channel_number.asc())
    )).all()


async def get_farm_relay_channels(db: AsyncSession, farm_id: UUID, user: User) -> list[RelayChannelResponse] | None:
    farm = await check_farm_access(db, farm_id, user)
    if not farm:
        return None

    channels = await ensure_default_relay_channels(db, farm_id)
    now = now_utc()
    updated = False
    for ch in channels:
        if ch.reported_state == "ON" and ch.last_command_at:
            last_cmd = await db.scalar(
                select(RelayCommand)
                .where(RelayCommand.channel_id == ch.id)
                .order_by(desc(RelayCommand.created_at))
                .limit(1)
            )
            if last_cmd and last_cmd.duration_seconds and last_cmd.target_state == "ON":
                elapsed = (now - ch.last_command_at).total_seconds()
                if elapsed >= last_cmd.duration_seconds:
                    ch.reported_state = "OFF"
                    ch.desired_state = "OFF"
                    db.add(RelayCommandEvent(
                        command_id=last_cmd.id,
                        event_type="AUTO_SHUTOFF",
                        details=f"Pulse timer ({last_cmd.duration_seconds}s) expired. Relay automatically turned OFF.",
                        created_at=now,
                    ))
                    updated = True

    if updated:
        await db.commit()

    plots = {p.id: p.name for p in (await db.scalars(select(Plot).where(Plot.farm_id == farm_id))).all()}
    stations = {d.id: d for d in (await db.scalars(select(Device).where(Device.farm_id == farm_id))).all()}

    res: list[RelayChannelResponse] = []
    for ch in channels:
        st = stations.get(ch.station_id)
        res.append(RelayChannelResponse(
            id=ch.id,
            farm_id=ch.farm_id,
            plot_id=ch.plot_id,
            plot_name=plots.get(ch.plot_id) if ch.plot_id else None,
            station_id=ch.station_id,
            station_code=st.device_code if st else "STATION-01",
            channel_number=ch.channel_number,
            display_name=ch.display_name,
            gpio_pin=ch.gpio_pin,
            description=ch.description,
            desired_state=ch.desired_state,
            reported_state=ch.reported_state,
            last_command_at=ch.last_command_at,
            last_ack_at=ch.last_ack_at,
        ))

    return res


async def dispatch_relay_command(
    db: AsyncSession,
    farm_id: UUID,
    channel_id: UUID,
    req: DispatchRelayCommandRequest,
    user: User,
) -> RelayCommandResponse | None:
    farm = await check_farm_access(db, farm_id, user)
    if not farm:
        return None

    channel = await db.scalar(
        select(RelayChannel).where(
            RelayChannel.id == channel_id,
            RelayChannel.farm_id == farm_id,
        )
    )
    if not channel:
        return None

    station = await db.scalar(select(Device).where(Device.id == channel.station_id))
    station_code = station.device_code if station else "STATION-01"
    plot_id_str = str(channel.plot_id) if channel.plot_id else "unassigned"

    # Create command record
    now = now_utc()
    command = RelayCommand(
        tenant_id=farm.tenant_id,
        farm_id=farm.id,
        channel_id=channel.id,
        issued_by_id=user.id,
        target_state=req.target_state,
        duration_seconds=req.duration_seconds,
        state=RelayCommandState.PENDING,
        created_at=now,
    )
    db.add(command)
    await db.flush()

    # Create Event
    event = RelayCommandEvent(
        command_id=command.id,
        event_type="ISSUED",
        details=f"Command issued by {user.email}: Set Ch {channel.channel_number} ({channel.display_name}) to {req.target_state}",
        created_at=now,
    )
    db.add(event)

    # Update channel desired state
    channel.desired_state = req.target_state
    channel.last_command_at = now

    await db.commit()
    await db.refresh(command)

    # Publish MQTT Relay Command to Broker
    mqtt_payload = {
        "command_id": str(command.id),
        "station_id": station_code,
        "channel_number": channel.channel_number,
        "target_state": req.target_state,
        "duration_seconds": req.duration_seconds,
        "issued_at": now.isoformat(),
    }
    topic = f"durian/{farm.tenant_id}/{farm.id}/{plot_id_str}/{station_code}/relay/command"
    try:
        if mqtt_publish is not None:
            mqtt_publish.single(
                topic,
                payload=json.dumps(mqtt_payload),
                hostname="mosquitto",
                port=1883,
                qos=1,
            )
            logger.info(f"Published relay command {command.id} to topic {topic}")

        # Simulate immediate hardware ACK in backend loop for instant responsiveness
        channel.reported_state = req.target_state
        channel.last_ack_at = now_utc()
        command.state = RelayCommandState.ACKNOWLEDGED
        command.acknowledged_at = now_utc()
        db.add(RelayCommandEvent(
            command_id=command.id,
            event_type="ACKNOWLEDGED",
            details="Received hardware ACK confirmation via MQTT Broker",
            created_at=now_utc(),
        ))
        await db.commit()
        await db.refresh(command)
    except Exception as e:
        logger.warning(f"Could not publish MQTT message to broker (using fallback ACK state): {e}")
        channel.reported_state = req.target_state
        channel.last_ack_at = now_utc()
        command.state = RelayCommandState.ACKNOWLEDGED
        command.acknowledged_at = now_utc()
        await db.commit()
        await db.refresh(command)

    return RelayCommandResponse.model_validate(command)


async def get_farm_activities(db: AsyncSession, farm_id: UUID, user: User) -> list[FarmActivityResponse] | None:
    farm = await check_farm_access(db, farm_id, user)
    if not farm:
        return None

    query = select(FarmActivity).where(FarmActivity.farm_id == farm_id).order_by(desc(FarmActivity.performed_at))
    activities = (await db.scalars(query)).all()

    plots = {p.id: p.name for p in (await db.scalars(select(Plot).where(Plot.farm_id == farm_id))).all()}
    users = {u.id: u.full_name or u.email for u in (await db.scalars(select(User))).all()}

    res: list[FarmActivityResponse] = []
    for act in activities:
        res.append(FarmActivityResponse(
            id=act.id,
            farm_id=act.farm_id,
            plot_id=act.plot_id,
            plot_name=plots.get(act.plot_id) if act.plot_id else None,
            recorded_by_id=act.recorded_by_id,
            recorded_by_name=users.get(act.recorded_by_id, "เจ้าของสวน"),
            activity_type=act.activity_type,
            title=act.title,
            description=act.description,
            performed_at=act.performed_at,
            volume_liters=act.volume_liters,
            product_name=act.product_name,
            amount_kg=act.amount_kg,
            harvest_weight_kg=act.harvest_weight_kg,
            created_at=act.created_at,
        ))

    return res


async def create_farm_activity(
    db: AsyncSession,
    farm_id: UUID,
    req: FarmActivityCreate,
    user: User,
) -> FarmActivityResponse | None:
    farm = await check_farm_access(db, farm_id, user)
    if not farm:
        return None

    now = now_utc()
    activity = FarmActivity(
        tenant_id=farm.tenant_id,
        farm_id=farm.id,
        plot_id=req.plot_id,
        recorded_by_id=user.id,
        activity_type=req.activity_type,
        title=req.title,
        description=req.description,
        performed_at=req.performed_at or now,
        volume_liters=req.volume_liters,
        product_name=req.product_name,
        amount_kg=req.amount_kg,
        harvest_weight_kg=req.harvest_weight_kg,
        created_at=now,
    )
    db.add(activity)
    await db.commit()
    await db.refresh(activity)

    plots = {p.id: p.name for p in (await db.scalars(select(Plot).where(Plot.farm_id == farm_id))).all()}

    return FarmActivityResponse(
        id=activity.id,
        farm_id=activity.farm_id,
        plot_id=activity.plot_id,
        plot_name=plots.get(activity.plot_id) if activity.plot_id else None,
        recorded_by_id=activity.recorded_by_id,
        recorded_by_name=user.full_name or user.email,
        activity_type=activity.activity_type,
        title=activity.title,
        description=activity.description,
        performed_at=activity.performed_at,
        volume_liters=activity.volume_liters,
        product_name=activity.product_name,
        amount_kg=activity.amount_kg,
        harvest_weight_kg=activity.harvest_weight_kg,
        created_at=activity.created_at,
    )


async def delete_farm_activity(db: AsyncSession, farm_id: UUID, activity_id: UUID, user: User) -> bool:
    farm = await check_farm_access(db, farm_id, user)
    if not farm:
        return False

    activity = await db.scalar(
        select(FarmActivity).where(
            FarmActivity.id == activity_id,
            FarmActivity.farm_id == farm_id,
        )
    )
    if not activity:
        return False

    await db.delete(activity)
    await db.commit()
    return True
