from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.identity.models import RoleCode, User
from app.domains.registry.models import Device, DeviceKind, DeviceStatus, Farm, FarmMembership, Plot, SensorAssignment
from app.domains.telemetry.models import DeviceHealthHistory, RawMqttMessage, SensorReading
from app.domains.telemetry.schemas import (
    AdminTelemetryOverview,
    DeviceHealthResponse,
    LatestTelemetryResponse,
    MetricValue,
    QuarantineLogItem,
    SensorTelemetrySummary,
    StationTelemetrySummary,
    TimeSeriesPoint,
    TimeSeriesResponse,
)


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


async def get_latest_telemetry(db: AsyncSession, farm_id: UUID, user: User) -> LatestTelemetryResponse | None:
    farm = await check_farm_access(db, farm_id, user)
    if not farm:
        return None

    # Load active stations and plots
    stations = (await db.scalars(
        select(Device).where(
            Device.farm_id == farm_id,
            Device.kind == DeviceKind.WEATHER_STATION,
            Device.status == DeviceStatus.ACTIVE,
        )
    )).all()

    sensors = (await db.scalars(
        select(Device).where(
            Device.farm_id == farm_id,
            Device.kind == DeviceKind.SOIL_SENSOR,
            Device.status == DeviceStatus.ACTIVE,
        )
    )).all()

    plots = {p.id: p.name for p in (await db.scalars(select(Plot).where(Plot.farm_id == farm_id))).all()}

    # Query recent readings in last 7 days
    recent_cutoff = now_utc() - timedelta(days=7)
    readings = (await db.scalars(
        select(SensorReading).where(
            SensorReading.farm_id == farm_id,
            SensorReading.observed_at >= recent_cutoff,
        ).order_by(desc(SensorReading.observed_at))
    )).all()

    # Build station summaries
    station_summaries: list[StationTelemetrySummary] = []
    for st in stations:
        st_readings = [r for r in readings if r.station_id == st.id and r.publisher_type == "WEATHER_STATION"]
        latest_metrics: dict[str, MetricValue] = {}
        last_seen = None

        for r in st_readings:
            if r.metric_key not in latest_metrics:
                latest_metrics[r.metric_key] = MetricValue(
                    metric_key=r.metric_key,
                    value=r.normalized_value if r.normalized_value is not None else r.raw_value,
                    raw_value=r.raw_value,
                    unit=r.unit,
                    quality=r.quality,
                    observed_at=r.observed_at,
                )
                if last_seen is None or r.observed_at > last_seen:
                    last_seen = r.observed_at

        # Health status
        health = await db.scalar(
            select(DeviceHealthHistory).where(
                DeviceHealthHistory.station_id == st.id,
            ).order_by(desc(DeviceHealthHistory.recorded_at)).limit(1)
        )

        st_status = "ONLINE" if (last_seen and (now_utc() - last_seen).total_seconds() < 900) else "OFFLINE"
        if health and health.status:
            st_status = health.status

        station_summaries.append(StationTelemetrySummary(
            station_id=st.id,
            station_code=st.device_code,
            display_name=st.display_name,
            plot_id=st.plot_id,
            plot_name=plots.get(st.plot_id) if st.plot_id else None,
            status=st_status,
            battery_pct=health.battery_pct if health else None,
            rssi_dbm=health.rssi_dbm if health else None,
            last_seen=last_seen,
            metrics=latest_metrics,
        ))

    # Build sensor summaries
    sensor_summaries: list[SensorTelemetrySummary] = []
    for s in sensors:
        s_readings = [r for r in readings if r.sensor_id == s.id]
        latest_metrics: dict[str, MetricValue] = {}
        last_seen = None

        for r in s_readings:
            if r.metric_key not in latest_metrics:
                latest_metrics[r.metric_key] = MetricValue(
                    metric_key=r.metric_key,
                    value=r.normalized_value if r.normalized_value is not None else r.raw_value,
                    raw_value=r.raw_value,
                    unit=r.unit,
                    quality=r.quality,
                    observed_at=r.observed_at,
                )
                if last_seen is None or r.observed_at > last_seen:
                    last_seen = r.observed_at

        sensor_summaries.append(SensorTelemetrySummary(
            sensor_id=s.id,
            sensor_code=s.device_code,
            display_name=s.display_name,
            sensor_type=s.soil_sensor.sensor_type if s.soil_sensor else "SOIL_7_IN_1",
            plot_id=s.plot_id,
            plot_name=plots.get(s.plot_id) if s.plot_id else None,
            metrics=latest_metrics,
            last_seen=last_seen,
        ))

    return LatestTelemetryResponse(
        farm_id=farm_id,
        retrieved_at=now_utc(),
        stations=station_summaries,
        sensors=sensor_summaries,
    )


async def get_time_series(
    db: AsyncSession,
    farm_id: UUID,
    metric_key: str,
    device_id: UUID | None,
    from_time: datetime | None,
    to_time: datetime | None,
    interval: str,
    user: User,
) -> TimeSeriesResponse | None:
    farm = await check_farm_access(db, farm_id, user)
    if not farm:
        return None

    if to_time is None:
        to_time = now_utc()
    if from_time is None:
        from_time = to_time - timedelta(days=1)

    query = select(SensorReading).where(
        SensorReading.farm_id == farm_id,
        SensorReading.metric_key == metric_key,
        SensorReading.observed_at >= from_time,
        SensorReading.observed_at <= to_time,
    )

    if device_id:
        query = query.where((SensorReading.station_id == device_id) | (SensorReading.sensor_id == device_id))

    query = query.order_by(SensorReading.observed_at.asc())
    readings = (await db.scalars(query)).all()

    unit = readings[0].unit if readings else ""

    points: list[TimeSeriesPoint] = []
    if interval == "raw" or not readings:
        for r in readings:
            points.append(TimeSeriesPoint(
                timestamp=r.observed_at,
                value=r.normalized_value if r.normalized_value is not None else r.raw_value,
                quality=r.quality,
            ))
    else:
        # Simple interval grouping (5m, 15m, 1h, 1d)
        bucket_seconds = 300 if interval == "5m" else 900 if interval == "15m" else 3600 if interval == "1h" else 86400
        buckets: dict[int, list[float]] = {}
        for r in readings:
            val = r.normalized_value if r.normalized_value is not None else r.raw_value
            if val is not None:
                ts_sec = int(r.observed_at.timestamp())
                b_key = (ts_sec // bucket_seconds) * bucket_seconds
                buckets.setdefault(b_key, []).append(val)

        for b_sec in sorted(buckets.keys()):
            vals = buckets[b_sec]
            points.append(TimeSeriesPoint(
                timestamp=datetime.fromtimestamp(b_sec, tz=timezone.utc),
                value=round(sum(vals) / len(vals), 2),
                min_value=round(min(vals), 2),
                max_value=round(max(vals), 2),
                count=len(vals),
                quality="valid",
            ))

    return TimeSeriesResponse(
        farm_id=farm_id,
        metric_key=metric_key,
        unit=unit,
        device_id=device_id,
        interval=interval,
        points=points,
    )


async def get_device_health(db: AsyncSession, device_id: UUID, user: User) -> DeviceHealthResponse | None:
    device = await db.scalar(select(Device).where(Device.id == device_id))
    if not device:
        return None

    farm = await check_farm_access(db, device.farm_id, user)
    if not farm:
        return None

    health = await db.scalar(
        select(DeviceHealthHistory).where(
            DeviceHealthHistory.station_id == device_id,
        ).order_by(desc(DeviceHealthHistory.recorded_at)).limit(1)
    )

    last_reading = await db.scalar(
        select(SensorReading.observed_at).where(
            (SensorReading.station_id == device_id) | (SensorReading.sensor_id == device_id)
        ).order_by(desc(SensorReading.observed_at)).limit(1)
    )

    return DeviceHealthResponse(
        device_id=device.id,
        device_code=device.device_code,
        display_name=device.display_name,
        kind=device.kind.value,
        status=health.status if health else "ONLINE" if last_reading else "UNKNOWN",
        battery_pct=health.battery_pct if health else None,
        battery_voltage=health.battery_voltage if health else None,
        rssi_dbm=health.rssi_dbm if health else None,
        uptime_seconds=health.uptime_seconds if health else None,
        firmware_version=device.firmware_version or (health.firmware_version if health else None),
        last_seen=last_reading,
    )


async def get_admin_telemetry_overview(db: AsyncSession, user: User) -> AdminTelemetryOverview | None:
    is_admin = any(role.code == RoleCode.ADMIN for role in user.roles)
    if not is_admin:
        return None

    active_stations_count = await db.scalar(
        select(func.count(Device.id)).where(
            Device.kind == DeviceKind.WEATHER_STATION,
            Device.status == DeviceStatus.ACTIVE,
        )
    ) or 0

    one_day_ago = now_utc() - timedelta(days=1)
    fifteen_mins_ago = now_utc() - timedelta(minutes=15)

    online_stations_count = await db.scalar(
        select(func.count(func.distinct(SensorReading.station_id))).where(
            SensorReading.observed_at >= fifteen_mins_ago,
        )
    ) or 0

    total_readings_24h = await db.scalar(
        select(func.count(SensorReading.id)).where(
            SensorReading.observed_at >= one_day_ago,
        )
    ) or 0

    quarantined_messages_24h = await db.scalar(
        select(func.count(RawMqttMessage.id)).where(
            RawMqttMessage.validation_status == "QUARANTINED",
            RawMqttMessage.received_at >= one_day_ago,
        )
    ) or 0

    recent_quarantine = (await db.scalars(
        select(RawMqttMessage).where(
            RawMqttMessage.validation_status == "QUARANTINED",
        ).order_by(desc(RawMqttMessage.received_at)).limit(20)
    )).all()

    quarantine_items = [
        QuarantineLogItem(
            id=msg.id,
            topic=msg.topic,
            message_id=msg.message_id,
            quarantine_reason=msg.quarantine_reason,
            validation_status=msg.validation_status,
            received_at=msg.received_at,
        ) for msg in recent_quarantine
    ]

    ingestion_rate = round(total_readings_24h / 1440.0, 2)

    return AdminTelemetryOverview(
        active_stations_count=active_stations_count,
        online_stations_count=online_stations_count,
        total_readings_24h=total_readings_24h,
        quarantined_messages_24h=quarantined_messages_24h,
        ingestion_rate_per_min=ingestion_rate,
        recent_quarantine_logs=quarantine_items,
    )
