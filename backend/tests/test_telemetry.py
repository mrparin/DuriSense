from datetime import datetime, timezone
import pytest
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
