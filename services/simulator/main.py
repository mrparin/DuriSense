import asyncio
from datetime import datetime, timezone
import json
import logging
import math
import os
import random
import time
from uuid import uuid4

from paho.mqtt import client as mqtt_client
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Ensure identity models are loaded in SQLAlchemy metadata
from app.domains.identity import models as identity_models  # noqa: F401
from app.domains.registry.models import CalibrationRecord, Device, DeviceKind, DeviceStatus, Farm, Plot, SensorAssignment, SoilSensor, SoilSensorType, WeatherStation
from app.domains.telemetry import models as telemetry_models  # noqa: F401

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("durisense-simulator")

DATABASE_URL = os.environ.get("DURISENSE_DATABASE_URL", "postgresql+asyncpg://durisense:change-me@db:5432/durisense")
MQTT_HOST = os.environ.get("DURISENSE_MQTT_HOST", "mosquitto")
MQTT_PORT = int(os.environ.get("DURISENSE_MQTT_PORT", "1883"))
PUBLISH_INTERVAL_SECONDS = int(os.environ.get("DURISENSE_SIMULATOR_INTERVAL", "10"))

engine = create_async_engine(DATABASE_URL, echo=False)
SessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def generate_weather_readings(hour_of_day: float) -> dict:
    # Diurnal solar cycle (sine wave peaking at 14:00)
    solar_factor = max(0.0, math.sin((hour_of_day - 6.0) / 12.0 * math.pi))

    air_temp = round(24.0 + (10.5 * solar_factor) + random.uniform(-0.4, 0.4), 1)
    air_rh = round(88.0 - (33.0 * solar_factor) + random.uniform(-1.0, 1.0), 1)
    illuminance = round(solar_factor * 65000.0 + random.uniform(0, 500), 0)
    wind_speed = round(0.8 + (1.8 * solar_factor) + random.uniform(-0.3, 0.5), 1)
    wind_dir = round((180 + (hour_of_day * 15) + random.uniform(-20, 20)) % 360, 0)

    return {
        "air_temperature": {"value": air_temp, "unit": "degC", "quality": "valid"},
        "air_relative_humidity": {"value": air_rh, "unit": "%RH", "quality": "valid"},
        "illuminance": {"value": illuminance, "unit": "lux", "quality": "valid"},
        "wind_speed_avg_5m": {"value": wind_speed, "unit": "m/s", "quality": "valid"},
        "wind_direction_deg": {"value": wind_dir, "unit": "degree", "quality": "valid"},
    }


def generate_soil_readings(hour_of_day: float, depth_cm: float = 30.0) -> dict:
    soil_temp = round(26.5 + (2.5 * math.sin((hour_of_day - 10.0) / 12.0 * math.pi)) + random.uniform(-0.2, 0.2), 1)
    soil_moisture = round(52.0 + random.uniform(-1.5, 1.5), 1)
    soil_ec = round(1220 + random.uniform(-25, 25), 0)
    soil_ph = round(6.45 + random.uniform(-0.05, 0.05), 2)
    soil_n = round(42.0 + random.uniform(-1.5, 1.5), 1)
    soil_p = round(21.0 + random.uniform(-1.0, 1.0), 1)
    soil_k = round(32.0 + random.uniform(-1.0, 1.0), 1)

    return {
        "soil_temperature": {"value": soil_temp, "unit": "degC", "quality": "valid"},
        "soil_moisture": {"value": soil_moisture, "unit": "%", "quality": "valid"},
        "soil_ec": {"value": soil_ec, "unit": "uS/cm", "quality": "valid"},
        "soil_ph": {"value": soil_ph, "unit": "pH", "quality": "valid"},
        "soil_n": {"value": soil_n, "unit": "mg/kg", "quality": "valid"},
        "soil_p": {"value": soil_p, "unit": "mg/kg", "quality": "valid"},
        "soil_k": {"value": soil_k, "unit": "mg/kg", "quality": "valid"},
    }


async def ensure_demo_devices(db: AsyncSession):
    farms = (await db.scalars(select(Farm))).all()
    user = await db.scalar(select(identity_models.User).limit(1))
    user_id = user.id if user else None

    for farm in farms:
        farm_plots = (await db.scalars(select(Plot).where(Plot.farm_id == farm.id))).all()
        if not farm_plots:
            continue

        for plot in farm_plots:
            plot_code_suffix = plot.name.replace(" ", "_")

            # 1. Ensure Weather Station for this Plot
            station = await db.scalar(
                select(Device).where(
                    Device.farm_id == farm.id,
                    Device.plot_id == plot.id,
                    Device.kind == DeviceKind.WEATHER_STATION,
                    Device.status == DeviceStatus.ACTIVE,
                )
            )
            if not station:
                station_code = f"WS-{farm.name[:3].upper()}-{plot_code_suffix[:6].upper()}"
                station = Device(
                    tenant_id=farm.tenant_id,
                    farm_id=farm.id,
                    plot_id=plot.id,
                    device_code=station_code,
                    display_name=f"สถานีตรวจอากาศ ({plot.name})",
                    kind=DeviceKind.WEATHER_STATION,
                    status=DeviceStatus.ACTIVE,
                    firmware_version="2.1.0",
                    weather_station=WeatherStation(model="ALL_IN_ONE", serial_number=f"SN-{uuid4().hex[:8].upper()}"),
                )
                db.add(station)
                await db.flush()
                logger.info(f"Auto-created Weather Station {station.device_code} for plot {plot.name} in farm {farm.name}")

            # 2. Ensure Soil Sensor for this Plot
            sensor = await db.scalar(
                select(Device).where(
                    Device.farm_id == farm.id,
                    Device.plot_id == plot.id,
                    Device.kind == DeviceKind.SOIL_SENSOR,
                    Device.status == DeviceStatus.ACTIVE,
                )
            )
            if not sensor:
                sensor_code = f"SOIL-{farm.name[:3].upper()}-{plot_code_suffix[:6].upper()}"
                sensor = Device(
                    tenant_id=farm.tenant_id,
                    farm_id=farm.id,
                    plot_id=plot.id,
                    device_code=sensor_code,
                    display_name=f"โพรบวัดดิน 7-in-1 ({plot.name})",
                    kind=DeviceKind.SOIL_SENSOR,
                    status=DeviceStatus.ACTIVE,
                    firmware_version="1.4.2",
                    soil_sensor=SoilSensor(sensor_type=SoilSensorType.SOIL_7_IN_1, modbus_address=1),
                )
                db.add(sensor)
                await db.flush()

                if user_id:
                    db.add(CalibrationRecord(
                        tenant_id=farm.tenant_id,
                        farm_id=farm.id,
                        sensor_id=sensor.id,
                        operator_id=user_id,
                        formula_type="LINEAR",
                        scale_factor=1.02,
                        offset_value=-0.10,
                        notes="Auto-Calibration Baseline",
                        calibrated_at=now_utc(),
                    ))
                    db.add(SensorAssignment(
                        tenant_id=farm.tenant_id,
                        farm_id=farm.id,
                        station_id=station.id,
                        sensor_id=sensor.id,
                        plot_id=plot.id,
                        installation_depth_cm=30.0,
                        installed_by=user_id,
                        valid_from=now_utc(),
                    ))
                logger.info(f"Auto-created Soil Sensor {sensor.device_code} for plot {plot.name} in farm {farm.name}")

    await db.commit()


async def simulate_iteration(client: mqtt_client.Client, sequence: int):
    now = now_utc()
    hour = now.hour + (now.minute / 60.0)

    async with SessionLocal() as db:
        await ensure_demo_devices(db)

        stations = (await db.scalars(
            select(Device).where(
                Device.kind == DeviceKind.WEATHER_STATION,
                Device.status == DeviceStatus.ACTIVE,
            )
        )).all()

        for st in stations:
            tenant_id = str(st.tenant_id)
            farm_id = str(st.farm_id)
            plot_id = str(st.plot_id) if st.plot_id else "unassigned"
            station_code = st.device_code

            # 1. Publish Weather Payload
            weather_payload = {
                "schema_version": "2.0",
                "message_id": f"msg_w_{uuid4().hex[:16]}",
                "station_id": station_code,
                "plot_id": plot_id,
                "sequence": sequence,
                "observed_at": now.isoformat(),
                "readings": generate_weather_readings(hour),
            }
            weather_topic = f"durian/{tenant_id}/{farm_id}/{plot_id}/{station_code}/weather"
            client.publish(weather_topic, json.dumps(weather_payload), qos=1)

            # 2. Publish Device Health Status
            status_payload = {
                "schema_version": "2.0",
                "message_id": f"msg_s_{uuid4().hex[:16]}",
                "station_id": station_code,
                "observed_at": now.isoformat(),
                "battery_pct": round(88.0 + random.uniform(-1.0, 1.0), 1),
                "battery_voltage": 4.15,
                "rssi_dbm": -65 + random.randint(-3, 3),
                "uptime_seconds": sequence * PUBLISH_INTERVAL_SECONDS,
                "firmware_version": st.firmware_version or "2.1.0",
                "status": "ONLINE",
            }
            status_topic = f"durian/{tenant_id}/{farm_id}/{plot_id}/{station_code}/status"
            client.publish(status_topic, json.dumps(status_payload), qos=1)

            # 3. Find Soil Sensors for this farm / station
            sensors = (await db.scalars(
                select(Device).where(
                    Device.farm_id == st.farm_id,
                    Device.kind == DeviceKind.SOIL_SENSOR,
                    Device.status == DeviceStatus.ACTIVE,
                )
            )).all()

            for sensor in sensors:
                sensor_code = sensor.device_code
                sensor_type = sensor.soil_sensor.sensor_type.value if sensor.soil_sensor else "SOIL_7_IN_1"
                sensor_plot_id = str(sensor.plot_id) if sensor.plot_id else plot_id

                soil_payload = {
                    "schema_version": "2.0",
                    "message_id": f"msg_soil_{uuid4().hex[:16]}",
                    "station_id": station_code,
                    "plot_id": sensor_plot_id,
                    "sensor_id": sensor_code,
                    "sensor_type": sensor_type,
                    "sequence": sequence,
                    "observed_at": now.isoformat(),
                    "readings": generate_soil_readings(hour, 30.0),
                }
                soil_topic = f"durian/{tenant_id}/{farm_id}/{plot_id}/{station_code}/soil/{sensor_code}"
                client.publish(soil_topic, json.dumps(soil_payload), qos=1)

        logger.info(f"Published live telemetry for {len(stations)} station(s) [sequence={sequence}]")


async def main():
    client = mqtt_client.Client(mqtt_client.CallbackAPIVersion.VERSION2, client_id="durisense_device_simulator")
    while True:
        try:
            logger.info(f"Simulator connecting to MQTT broker at {MQTT_HOST}:{MQTT_PORT}...")
            client.connect(MQTT_HOST, MQTT_PORT, keepalive=60)
            client.loop_start()
            break
        except Exception as e:
            logger.warning(f"MQTT connect retry in 3s: {e}")
            await asyncio.sleep(3)

    sequence = 1
    while True:
        try:
            await simulate_iteration(client, sequence)
            sequence += 1
        except Exception as err:
            logger.error(f"Simulator iteration error: {err}")
        await asyncio.sleep(PUBLISH_INTERVAL_SECONDS)


if __name__ == "__main__":
    asyncio.run(main())
