from datetime import datetime, timezone

try:
    import pytest
except ImportError:
    class DummyPytest:
        class mark:
            @staticmethod
            def asyncio(f):
                return f
    pytest = DummyPytest()

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.identity.models import RoleCode, User
from app.domains.registry.models import CalibrationRecord, Device, DeviceKind, DeviceStatus, Farm, FarmMembership, FarmRole, Plot, SensorAssignment, SoilSensor, WeatherStation
from app.domains.telemetry.models import DeviceHealthHistory, RawMqttMessage, SensorReading
from packages.contracts.telemetry import METRIC_RANGE_LIMITS, QualityFlag, ReadingItem, SoilPayloadV2, WeatherPayloadV2


@pytest.mark.asyncio
async def test_telemetry_contracts():
    now = datetime.now(timezone.utc)
    w_payload = WeatherPayloadV2(
        schema_version="2.0",
        message_id="msg_weather_test_001",
        station_id="WS-TEST-001",
        observed_at=now,
        readings={
            "air_temperature": ReadingItem(value=30.5, unit="degC", quality=QualityFlag.VALID),
            "air_relative_humidity": ReadingItem(value=75.0, unit="%RH", quality=QualityFlag.VALID),
        },
    )
    assert w_payload.station_id == "WS-TEST-001"
    assert w_payload.readings["air_temperature"].value == 30.5

    soil_payload = SoilPayloadV2(
        schema_version="2.0",
        message_id="msg_soil_test_001",
        station_id="WS-TEST-001",
        sensor_id="SOIL-TEST-001",
        sensor_type="SOIL_7_IN_1",
        observed_at=now,
        readings={
            "soil_moisture": ReadingItem(value=52.0, unit="%", quality=QualityFlag.VALID),
            "soil_ph": ReadingItem(value=6.4, unit="pH", quality=QualityFlag.VALID),
        },
    )
    assert soil_payload.sensor_id == "SOIL-TEST-001"
    assert soil_payload.readings["soil_ph"].value == 6.4


@pytest.mark.asyncio
async def test_telemetry_range_limits():
    min_v, max_v, unit = METRIC_RANGE_LIMITS["air_temperature"]
    assert min_v == -10.0
    assert max_v == 60.0
    assert unit == "degC"

    min_v, max_v, unit = METRIC_RANGE_LIMITS["soil_ph"]
    assert min_v == 0.0
    assert max_v == 14.0
    assert unit == "pH"


def test_battery_status_evaluation():
    from app.domains.telemetry.service import get_battery_status
    assert get_battery_status(85.0) == "GOOD"
    assert get_battery_status(50.0) == "GOOD"
    assert get_battery_status(35.0) == "FAIR"
    assert get_battery_status(20.0) == "FAIR"
    assert get_battery_status(15.0) == "LOW"
    assert get_battery_status(10.0) == "LOW"
    assert get_battery_status(5.0) == "CRITICAL"
    assert get_battery_status(None) == "UNKNOWN"


def test_signal_quality_evaluation():
    from app.domains.telemetry.service import get_signal_quality
    assert get_signal_quality(-60) == "EXCELLENT"
    assert get_signal_quality(-65) == "EXCELLENT"
    assert get_signal_quality(-70) == "GOOD"
    assert get_signal_quality(-75) == "GOOD"
    assert get_signal_quality(-80) == "FAIR"
    assert get_signal_quality(-85) == "FAIR"
    assert get_signal_quality(-90) == "POOR"
    assert get_signal_quality(None) == "UNKNOWN"


def test_duration_th_formatting():
    from app.domains.telemetry.service import format_duration_th
    assert format_duration_th(45) == "45 วินาที"
    assert format_duration_th(300) == "5 นาที"
    assert format_duration_th(3600) == "1 ชม."
    assert format_duration_th(5400) == "1 ชม. 30 นาที"
    assert format_duration_th(86400) == "1 วัน"
    assert format_duration_th(90000) == "1 วัน 1 ชม."


def test_device_health_status_determination():
    from datetime import timedelta
    from app.domains.telemetry.service import determine_device_health_status, now_utc

    now = now_utc()

    # 1. No last_seen -> OFFLINE
    assert determine_device_health_status(None) == "OFFLINE"

    # 2. Last seen > timeout (3600s) -> OFFLINE
    assert determine_device_health_status(now - timedelta(seconds=3700)) == "OFFLINE"

    # 3. Last seen 1200s ago (> 900s) -> DEGRADED
    assert determine_device_health_status(now - timedelta(seconds=1200), battery_pct=80.0, rssi_dbm=-65) == "DEGRADED"

    # 4. Low battery (< 20%) -> DEGRADED
    assert determine_device_health_status(now - timedelta(seconds=300), battery_pct=15.0, rssi_dbm=-65) == "DEGRADED"

    # 5. Poor signal (<-85) -> DEGRADED
    assert determine_device_health_status(now - timedelta(seconds=300), battery_pct=80.0, rssi_dbm=-92) == "DEGRADED"

    # 6. Normal -> ONLINE
    assert determine_device_health_status(now - timedelta(seconds=120), battery_pct=85.0, rssi_dbm=-60) == "ONLINE"


def test_phase_2b_schemas():
    from uuid import uuid4
    from app.domains.telemetry.schemas import (
        DataGapItem,
        DataGapReportResponse,
        DeviceHealthDetailResponse,
        FarmHealthSummaryResponse,
        OfflineCheckResult,
        StationGapSummary,
        StationHealthSummary,
    )

    now = datetime.now(timezone.utc)
    station_id = uuid4()
    farm_id = uuid4()

    gap = DataGapItem(
        id="gap-WS-01-1",
        station_id=station_id,
        station_code="WS-01",
        station_name="สถานีแปลงที่ 1",
        gap_start=now,
        gap_end=now,
        duration_seconds=3600.0,
        duration_formatted="1 ชม.",
        severity="MINOR",
        probable_cause="ขาดการส่งข้อมูล",
    )
    assert gap.duration_seconds == 3600.0
    assert gap.severity == "MINOR"

    gap_report = DataGapReportResponse(
        farm_id=farm_id,
        start_date=now,
        end_date=now,
        threshold_minutes=30,
        total_gaps_count=1,
        total_gap_duration_seconds=3600.0,
        overall_completeness_pct=95.5,
        gaps=[gap],
        stations_summary=[
            StationGapSummary(
                station_id=station_id,
                station_code="WS-01",
                station_name="สถานีแปลงที่ 1",
                total_gaps=1,
                total_gap_seconds=3600.0,
                completeness_pct=95.5,
            )
        ],
    )
    assert gap_report.overall_completeness_pct == 95.5
    assert len(gap_report.gaps) == 1

    check_res = OfflineCheckResult(
        checked_at=now,
        total_devices_checked=2,
        offline_devices_count=1,
        offline_device_codes=["WS-02"],
        alerts_triggered=1,
    )
    assert check_res.offline_devices_count == 1
    assert check_res.alerts_triggered == 1


if __name__ == "__main__":
    import asyncio
    asyncio.run(test_telemetry_contracts())
    asyncio.run(test_telemetry_range_limits())
    test_battery_status_evaluation()
    test_signal_quality_evaluation()
    test_duration_th_formatting()
    test_device_health_status_determination()
    test_phase_2b_schemas()
    print("ALL 7 TELEMETRY & PHASE 2B TESTS PASSED SUCCESSFULLY!")


