from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.alerts.models import AlertEvent, AlertRule, AlertSeverity, AlertState
from app.domains.identity.models import RoleCode, User
from app.domains.registry.models import Device, DeviceKind, DeviceStatus, Farm, FarmMembership, Plot, SensorAssignment
from app.domains.telemetry.models import DeviceHealthHistory, RawMqttMessage, SensorReading
from app.domains.telemetry.schemas import (
    AdminTelemetryOverview,
    DataGapItem,
    DataGapReportResponse,
    DeviceHealthDetailResponse,
    DeviceHealthHistoryItem,
    DeviceHealthResponse,
    FarmHealthSummaryResponse,
    LatestTelemetryResponse,
    MetricValue,
    OfflineCheckResult,
    QuarantineLogItem,
    SensorHealthSummary,
    SensorTelemetrySummary,
    StationGapSummary,
    StationHealthSummary,
    StationTelemetrySummary,
    TimeSeriesPoint,
    TimeSeriesResponse,
)


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def get_battery_status(battery_pct: float | None) -> str:
    if battery_pct is None:
        return "UNKNOWN"
    if battery_pct >= 50.0:
        return "GOOD"
    if battery_pct >= 20.0:
        return "FAIR"
    if battery_pct >= 10.0:
        return "LOW"
    return "CRITICAL"


def get_signal_quality(rssi_dbm: int | None) -> str:
    if rssi_dbm is None:
        return "UNKNOWN"
    if rssi_dbm >= -65:
        return "EXCELLENT"
    if rssi_dbm >= -75:
        return "GOOD"
    if rssi_dbm >= -85:
        return "FAIR"
    return "POOR"


def format_duration_th(seconds: float) -> str:
    secs = int(max(0, seconds))
    if secs < 60:
        return f"{secs} วินาที"
    mins = secs // 60
    if mins < 60:
        return f"{mins} นาที"
    hours = mins // 60
    rem_mins = mins % 60
    if hours < 24:
        return f"{hours} ชม. {rem_mins} นาที" if rem_mins else f"{hours} ชม."
    days = hours // 24
    rem_hours = hours % 24
    return f"{days} วัน {rem_hours} ชม." if rem_hours else f"{days} วัน"


def determine_device_health_status(
    last_seen: datetime | None,
    battery_pct: float | None = None,
    rssi_dbm: int | None = None,
    timeout_seconds: int = 3600,
) -> str:
    if not last_seen:
        return "OFFLINE"
    diff_sec = (now_utc() - last_seen).total_seconds()
    if diff_sec > timeout_seconds:
        return "OFFLINE"
    if (battery_pct is not None and battery_pct < 20.0) or (rssi_dbm is not None and rssi_dbm < -85) or (diff_sec > 900):
        return "DEGRADED"
    return "ONLINE"


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

        batt_pct = health.battery_pct if health else None
        rssi = health.rssi_dbm if health else None
        st_status = determine_device_health_status(last_seen, batt_pct, rssi)

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


# ==================== Phase 2B: Device Health & Data Gap ====================

async def get_farm_health_summary(
    db: AsyncSession,
    farm_id: UUID,
    user: User,
) -> FarmHealthSummaryResponse | None:
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

    plot_ids = [st.plot_id for st in stations if st.plot_id] + [s.plot_id for s in sensors if s.plot_id]
    plots = {}
    if plot_ids:
        plot_items = (await db.scalars(select(Plot).where(Plot.id.in_(plot_ids)))).all()
        plots = {p.id: p.name for p in plot_items}

    # Station health summaries
    station_summaries: list[StationHealthSummary] = []
    online_count = 0
    degraded_count = 0
    offline_count = 0
    low_battery_count = 0
    weak_signal_count = 0

    for st in stations:
        health = await db.scalar(
            select(DeviceHealthHistory).where(
                DeviceHealthHistory.station_id == st.id,
            ).order_by(desc(DeviceHealthHistory.recorded_at)).limit(1)
        )
        last_reading = await db.scalar(
            select(SensorReading.observed_at).where(
                (SensorReading.station_id == st.id) | (SensorReading.sensor_id == st.id)
            ).order_by(desc(SensorReading.observed_at)).limit(1)
        )

        last_seen = last_reading or (health.recorded_at if health else None)
        batt_pct = health.battery_pct if health else None
        rssi = health.rssi_dbm if health else None

        status = determine_device_health_status(last_seen, batt_pct, rssi)
        batt_status = get_battery_status(batt_pct)
        signal_qual = get_signal_quality(rssi)

        if status == "ONLINE":
            online_count += 1
        elif status == "DEGRADED":
            degraded_count += 1
        else:
            offline_count += 1

        if batt_pct is not None and batt_pct < 20.0:
            low_battery_count += 1
        if rssi is not None and rssi < -85:
            weak_signal_count += 1

        sensor_cnt = await db.scalar(
            select(func.count(SensorAssignment.id)).where(
                SensorAssignment.station_id == st.id,
                SensorAssignment.valid_to.is_(None),
            )
        ) or 0

        station_summaries.append(StationHealthSummary(
            station_id=st.id,
            station_code=st.device_code,
            display_name=st.display_name,
            plot_id=st.plot_id,
            plot_name=plots.get(st.plot_id) if st.plot_id else None,
            status=status,
            battery_pct=batt_pct,
            battery_status=batt_status,
            rssi_dbm=rssi,
            signal_quality=signal_qual,
            last_seen=last_seen,
            assigned_sensor_count=sensor_cnt,
        ))

    # Sensor health summaries
    sensor_summaries: list[SensorHealthSummary] = []
    for s in sensors:
        last_s_reading = await db.scalar(
            select(SensorReading.observed_at).where(
                SensorReading.sensor_id == s.id
            ).order_by(desc(SensorReading.observed_at)).limit(1)
        )
        s_status = determine_device_health_status(last_s_reading)
        sensor_type_val = s.soil_sensor.sensor_type.value if (s.soil_sensor and hasattr(s.soil_sensor.sensor_type, 'value')) else (s.soil_sensor.sensor_type if s.soil_sensor else "SOIL_7_IN_1")
        sensor_summaries.append(SensorHealthSummary(
            sensor_id=s.id,
            sensor_code=s.device_code,
            display_name=s.display_name,
            sensor_type=str(sensor_type_val),
            plot_id=s.plot_id,
            plot_name=plots.get(s.plot_id) if s.plot_id else None,
            status=s_status,
            last_seen=last_s_reading,
        ))

    return FarmHealthSummaryResponse(
        farm_id=farm_id,
        total_stations=len(stations),
        total_sensors=len(sensors),
        online_stations=online_count,
        degraded_stations=degraded_count,
        offline_stations=offline_count,
        low_battery_count=low_battery_count,
        weak_signal_count=weak_signal_count,
        stations=station_summaries,
        sensors=sensor_summaries,
    )


async def get_device_health_detail(
    db: AsyncSession,
    device_id: UUID,
    user: User,
) -> DeviceHealthDetailResponse | None:
    device = await db.scalar(select(Device).where(Device.id == device_id))
    if not device:
        return None

    farm = await check_farm_access(db, device.farm_id, user)
    if not farm:
        return None

    plot = None
    if device.plot_id:
        plot = await db.scalar(select(Plot).where(Plot.id == device.plot_id))

    health = await db.scalar(
        select(DeviceHealthHistory).where(
            DeviceHealthHistory.station_id == device_id,
        ).order_by(desc(DeviceHealthHistory.recorded_at)).limit(1)
    )

    history_records = (await db.scalars(
        select(DeviceHealthHistory).where(
            DeviceHealthHistory.station_id == device_id,
        ).order_by(desc(DeviceHealthHistory.recorded_at)).limit(50)
    )).all()

    last_reading = await db.scalar(
        select(SensorReading.observed_at).where(
            (SensorReading.station_id == device_id) | (SensorReading.sensor_id == device_id)
        ).order_by(desc(SensorReading.observed_at)).limit(1)
    )

    last_seen = last_reading or (health.recorded_at if health else None)
    batt_pct = health.battery_pct if health else None
    rssi = health.rssi_dbm if health else None
    status = determine_device_health_status(last_seen, batt_pct, rssi)

    offline_sec = (now_utc() - last_seen).total_seconds() if last_seen else None
    uptime_fmt = format_duration_th(health.uptime_seconds) if (health and health.uptime_seconds) else None

    return DeviceHealthDetailResponse(
        device_id=device.id,
        device_code=device.device_code,
        display_name=device.display_name,
        kind=device.kind.value if hasattr(device.kind, "value") else str(device.kind),
        plot_id=device.plot_id,
        plot_name=plot.name if plot else None,
        status=status,
        battery_pct=batt_pct,
        battery_voltage=health.battery_voltage if health else None,
        battery_status=get_battery_status(batt_pct),
        rssi_dbm=rssi,
        signal_quality=get_signal_quality(rssi),
        uptime_seconds=health.uptime_seconds if health else None,
        uptime_formatted=uptime_fmt,
        firmware_version=device.firmware_version or (health.firmware_version if health else None),
        last_seen=last_seen,
        offline_duration_seconds=offline_sec if status == "OFFLINE" else None,
        recent_history=[
            DeviceHealthHistoryItem(
                recorded_at=h.recorded_at,
                battery_pct=h.battery_pct,
                battery_voltage=h.battery_voltage,
                rssi_dbm=h.rssi_dbm,
                status=h.status,
                uptime_seconds=h.uptime_seconds,
            ) for h in history_records
        ],
    )


async def get_farm_data_gaps(
    db: AsyncSession,
    farm_id: UUID,
    start_date: datetime,
    end_date: datetime,
    threshold_minutes: int = 30,
    station_id: UUID | None = None,
    user: User | None = None,
) -> DataGapReportResponse | None:
    if user:
        farm = await check_farm_access(db, farm_id, user)
        if not farm:
            return None

    query = select(Device).where(
        Device.farm_id == farm_id,
        Device.kind == DeviceKind.WEATHER_STATION,
        Device.status == DeviceStatus.ACTIVE,
    )
    if station_id:
        query = query.where(Device.id == station_id)

    stations = (await db.scalars(query)).all()
    if not stations:
        return DataGapReportResponse(
            farm_id=farm_id,
            start_date=start_date,
            end_date=end_date,
            threshold_minutes=threshold_minutes,
            total_gaps_count=0,
            total_gap_duration_seconds=0.0,
            overall_completeness_pct=100.0,
            gaps=[],
            stations_summary=[],
        )

    plot_ids = [st.plot_id for st in stations if st.plot_id]
    plots = {}
    if plot_ids:
        plot_items = (await db.scalars(select(Plot).where(Plot.id.in_(plot_ids)))).all()
        plots = {p.id: p.name for p in plot_items}

    threshold_seconds = threshold_minutes * 60
    total_window_seconds = max((end_date - start_date).total_seconds(), 1.0)
    now = now_utc()
    effective_end = min(end_date, now)

    all_gaps: list[DataGapItem] = []
    stations_summary: list[StationGapSummary] = []
    gap_counter = 1

    for st in stations:
        timestamps = (await db.scalars(
            select(func.distinct(SensorReading.observed_at))
            .where(
                SensorReading.station_id == st.id,
                SensorReading.observed_at >= start_date,
                SensorReading.observed_at <= end_date,
            )
            .order_by(SensorReading.observed_at.asc())
        )).all()

        st_gaps: list[DataGapItem] = []
        st_gap_seconds = 0.0

        if not timestamps:
            window_sec = (effective_end - start_date).total_seconds()
            if window_sec >= threshold_seconds:
                severity = "CRITICAL" if window_sec >= 21600 else ("MODERATE" if window_sec >= 7200 else "MINOR")
                gap_item = DataGapItem(
                    id=f"gap-{st.device_code}-{gap_counter}",
                    station_id=st.id,
                    station_code=st.device_code,
                    station_name=st.display_name,
                    plot_name=plots.get(st.plot_id) if st.plot_id else None,
                    gap_start=start_date,
                    gap_end=effective_end,
                    duration_seconds=window_sec,
                    duration_formatted=format_duration_th(window_sec),
                    severity=severity,
                    probable_cause="ไม่พบการส่งข้อมูลตลอดช่วงเวลา (No Data Detected)",
                )
                gap_counter += 1
                st_gaps.append(gap_item)
                st_gap_seconds += window_sec
        else:
            first_pt = timestamps[0]
            start_gap_sec = (first_pt - start_date).total_seconds()
            if start_gap_sec >= threshold_seconds:
                sev = "CRITICAL" if start_gap_sec >= 21600 else ("MODERATE" if start_gap_sec >= 7200 else "MINOR")
                gap_item = DataGapItem(
                    id=f"gap-{st.device_code}-{gap_counter}",
                    station_id=st.id,
                    station_code=st.device_code,
                    station_name=st.display_name,
                    plot_name=plots.get(st.plot_id) if st.plot_id else None,
                    gap_start=start_date,
                    gap_end=first_pt,
                    duration_seconds=start_gap_sec,
                    duration_formatted=format_duration_th(start_gap_sec),
                    severity=sev,
                    probable_cause="เริ่มส่งข้อมูลล่าช้า / ข้อมูลช่วงต้นขาดหาย",
                )
                gap_counter += 1
                st_gaps.append(gap_item)
                st_gap_seconds += start_gap_sec

            for i in range(len(timestamps) - 1):
                t1 = timestamps[i]
                t2 = timestamps[i + 1]
                diff_sec = (t2 - t1).total_seconds()
                if diff_sec >= threshold_seconds:
                    sev = "CRITICAL" if diff_sec >= 21600 else ("MODERATE" if diff_sec >= 7200 else "MINOR")
                    cause = "สถานีหยุดส่งสัญญาณชั่วคราว (Connection Lost)" if diff_sec < 7200 else "สถานีออฟไลน์เป็นเวลานาน (Offline Period)"
                    gap_item = DataGapItem(
                        id=f"gap-{st.device_code}-{gap_counter}",
                        station_id=st.id,
                        station_code=st.device_code,
                        station_name=st.display_name,
                        plot_name=plots.get(st.plot_id) if st.plot_id else None,
                        gap_start=t1,
                        gap_end=t2,
                        duration_seconds=diff_sec,
                        duration_formatted=format_duration_th(diff_sec),
                        severity=sev,
                        probable_cause=cause,
                    )
                    gap_counter += 1
                    st_gaps.append(gap_item)
                    st_gap_seconds += diff_sec

            last_pt = timestamps[-1]
            end_gap_sec = (effective_end - last_pt).total_seconds()
            if end_gap_sec >= threshold_seconds:
                sev = "CRITICAL" if end_gap_sec >= 21600 else ("MODERATE" if end_gap_sec >= 7200 else "MINOR")
                gap_item = DataGapItem(
                    id=f"gap-{st.device_code}-{gap_counter}",
                    station_id=st.id,
                    station_code=st.device_code,
                    station_name=st.display_name,
                    plot_name=plots.get(st.plot_id) if st.plot_id else None,
                    gap_start=last_pt,
                    gap_end=effective_end,
                    duration_seconds=end_gap_sec,
                    duration_formatted=format_duration_th(end_gap_sec),
                    severity=sev,
                    probable_cause="สัญญาณขาดหายจนถึงปัจจุบัน (Currently Offline)",
                )
                gap_counter += 1
                st_gaps.append(gap_item)
                st_gap_seconds += end_gap_sec

        st_completeness = max(0.0, min(100.0, round(((total_window_seconds - st_gap_seconds) / total_window_seconds) * 100.0, 1)))
        stations_summary.append(StationGapSummary(
            station_id=st.id,
            station_code=st.device_code,
            station_name=st.display_name,
            total_gaps=len(st_gaps),
            total_gap_seconds=round(st_gap_seconds, 1),
            completeness_pct=st_completeness,
        ))
        all_gaps.extend(st_gaps)

    all_gaps.sort(key=lambda g: g.gap_start, reverse=True)
    total_gap_sec = sum(g.duration_seconds for g in all_gaps)
    overall_comp = round(sum(s.completeness_pct for s in stations_summary) / len(stations_summary), 1) if stations_summary else 100.0

    return DataGapReportResponse(
        farm_id=farm_id,
        start_date=start_date,
        end_date=end_date,
        threshold_minutes=threshold_minutes,
        total_gaps_count=len(all_gaps),
        total_gap_duration_seconds=round(total_gap_sec, 1),
        overall_completeness_pct=overall_comp,
        gaps=all_gaps,
        stations_summary=stations_summary,
    )


async def check_farm_offline_devices(
    db: AsyncSession,
    farm_id: UUID,
    timeout_seconds: int = 3600,
    user: User | None = None,
) -> OfflineCheckResult:
    if user:
        farm = await check_farm_access(db, farm_id, user)
        if not farm:
            return OfflineCheckResult(checked_at=now_utc())
    else:
        farm = await db.scalar(select(Farm).where(Farm.id == farm_id))
        if not farm:
            return OfflineCheckResult(checked_at=now_utc())

    stations = (await db.scalars(
        select(Device).where(
            Device.farm_id == farm_id,
            Device.kind == DeviceKind.WEATHER_STATION,
            Device.status == DeviceStatus.ACTIVE,
        )
    )).all()

    now = now_utc()
    offline_codes: list[str] = []
    alerts_triggered = 0

    offline_rules = (await db.scalars(
        select(AlertRule).where(
            AlertRule.farm_id == farm_id,
            AlertRule.is_active.is_(True),
            (AlertRule.metric_type == "OFFLINE_TIMEOUT") | (AlertRule.operator == "OFFLINE_TIMEOUT"),
        )
    )).all()

    for st in stations:
        last_reading = await db.scalar(
            select(SensorReading.observed_at).where(
                (SensorReading.station_id == st.id) | (SensorReading.sensor_id == st.id)
            ).order_by(desc(SensorReading.observed_at)).limit(1)
        )
        health = await db.scalar(
            select(DeviceHealthHistory).where(
                DeviceHealthHistory.station_id == st.id,
            ).order_by(desc(DeviceHealthHistory.recorded_at)).limit(1)
        )
        last_seen = last_reading or (health.recorded_at if health else None)
        diff_sec = (now - last_seen).total_seconds() if last_seen else 999999.0

        is_offline = not last_seen or diff_sec > timeout_seconds

        if is_offline:
            offline_codes.append(st.device_code)
            for rule in offline_rules:
                if rule.plot_id and st.plot_id and rule.plot_id != st.plot_id:
                    continue
                if rule.station_id and rule.station_id != st.id:
                    continue

                existing_open = await db.scalar(
                    select(AlertEvent).where(
                        AlertEvent.rule_id == rule.id,
                        AlertEvent.station_id == st.id,
                        AlertEvent.state.in_([AlertState.OPEN, AlertState.ACKNOWLEDGED]),
                    )
                )
                if not existing_open:
                    event = AlertEvent(
                        tenant_id=farm.tenant_id,
                        farm_id=farm_id,
                        rule_id=rule.id,
                        station_id=st.id,
                        plot_id=st.plot_id,
                        severity=rule.severity or AlertSeverity.CRITICAL,
                        state=AlertState.OPEN,
                        triggered_value=round(diff_sec / 60.0, 1),
                        title=f"สถานี {st.device_code} ขาดการติดต่อ (Offline)",
                        message=f"สถานี {st.display_name} ไม่ส่งข้อมูลมานานกว่า {int(diff_sec // 60)} นาที (เกณฑ์กำหนด {timeout_seconds // 60} นาที)",
                        created_at=now,
                    )
                    db.add(event)
                    alerts_triggered += 1
        else:
            open_alerts = (await db.scalars(
                select(AlertEvent).where(
                    AlertEvent.farm_id == farm_id,
                    AlertEvent.station_id == st.id,
                    AlertEvent.state.in_([AlertState.OPEN, AlertState.ACKNOWLEDGED]),
                )
            )).all()
            for oa in open_alerts:
                if "Offline" in (oa.title or "") or "OFFLINE" in (oa.title or ""):
                    oa.state = AlertState.RESOLVED
                    oa.resolved_at = now
                    oa.resolve_reason = f"สถานีกลับมาออนไลน์ตามปกติแล้วเมื่อ {last_seen.strftime('%H:%M:%S') if last_seen else ''}"
                    oa.updated_at = now

    await db.commit()

    return OfflineCheckResult(
        checked_at=now,
        total_devices_checked=len(stations),
        offline_devices_count=len(offline_codes),
        offline_device_codes=offline_codes,
        alerts_triggered=alerts_triggered,
    )
