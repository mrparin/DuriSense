import asyncio
from datetime import datetime, timezone
import json
import logging
import os
import sys
from uuid import UUID

from paho.mqtt import client as mqtt_client
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Ensure identity models are loaded in SQLAlchemy metadata
from app.domains.identity import models as identity_models  # noqa: F401
from app.domains.registry import models as registry_models  # noqa: F401
from app.domains.telemetry import models as telemetry_models  # noqa: F401

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("durisense-ingestor")

# Database setup
DATABASE_URL = os.environ.get("DURISENSE_DATABASE_URL", "postgresql+asyncpg://durisense:change-me@db:5432/durisense")
MQTT_HOST = os.environ.get("DURISENSE_MQTT_HOST", "mosquitto")
MQTT_PORT = int(os.environ.get("DURISENSE_MQTT_PORT", "1883"))
MQTT_TOPIC_ROOT = os.environ.get("DURISENSE_MQTT_TOPIC", "durian/#")

engine = create_async_engine(DATABASE_URL, echo=False)
SessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

# Metric limits
METRIC_RANGE_LIMITS = {
    "air_temperature": (-10.0, 60.0, "degC"),
    "air_relative_humidity": (0.0, 100.0, "%RH"),
    "wind_speed_avg_5m": (0.0, 60.0, "m/s"),
    "wind_direction_deg": (0.0, 360.0, "degree"),
    "illuminance": (0.0, 200000.0, "lux"),
    "solar_radiation": (0.0, 1500.0, "W/m2"),
    "rain_accumulation": (0.0, 500.0, "mm"),
    "soil_temperature": (-10.0, 60.0, "degC"),
    "soil_moisture": (0.0, 100.0, "%"),
    "soil_ec": (0.0, 20000.0, "uS/cm"),
    "soil_ph": (0.0, 14.0, "pH"),
    "soil_n": (0.0, 2000.0, "mg/kg"),
    "soil_p": (0.0, 2000.0, "mg/kg"),
    "soil_k": (0.0, 2000.0, "mg/kg"),
}


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def parse_datetime(dt_str: str | None) -> datetime:
    if not dt_str:
        return now_utc()
    try:
        return datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
    except Exception:
        return now_utc()


async def process_mqtt_message(topic: str, payload_raw: bytes):
    received_at = now_utc()
    try:
        payload_str = payload_raw.decode("utf-8")
        payload = json.loads(payload_str)
    except Exception as exc:
        logger.warning(f"Failed to parse JSON payload on {topic}: {exc}")
        async with SessionLocal() as db:
            from app.domains.telemetry.models import RawMqttMessage
            db.add(RawMqttMessage(
                topic=topic,
                payload={"raw": payload_raw.decode("utf-8", errors="replace")},
                validation_status="QUARANTINED",
                quarantine_reason=f"Invalid JSON: {exc}",
                received_at=received_at,
            ))
            await db.commit()
        return

    # Topic convention: durian/{tenant_id}/{farm_id}/{plot_id}/{station_code}/{type}[/{sensor_code}]
    parts = topic.strip("/").split("/")
    if len(parts) < 5 or parts[0] != "durian":
        logger.debug(f"Ignored non-durian topic: {topic}")
        return

    msg_type = parts[5] if len(parts) >= 6 else parts[-1]
    message_id = payload.get("message_id")
    station_code = payload.get("station_id") or parts[4]

    async with SessionLocal() as db:
        from app.domains.registry.models import CalibrationRecord, Device, DeviceKind, DeviceStatus, Farm, Plot, SensorAssignment
        from app.domains.telemetry.models import DeviceHealthHistory, RawMqttMessage, SensorReading

        # Check deduplication
        if message_id:
            dup = await db.scalar(
                select(SensorReading.id).where(SensorReading.message_id == message_id).limit(1)
            )
            if dup:
                logger.info(f"Duplicate message_id {message_id} on {topic} ignored.")
                return

        # Find Weather Station
        station = await db.scalar(
            select(Device).where(
                (Device.device_code == station_code) | (Device.id == station_code if len(station_code) == 36 else False),
                Device.kind == DeviceKind.WEATHER_STATION,
            )
        )
        if not station:
            quarantine_reason = f"Weather Station '{station_code}' not found in registry"
            logger.warning(quarantine_reason)
            db.add(RawMqttMessage(
                topic=topic,
                message_id=message_id,
                payload=payload,
                validation_status="QUARANTINED",
                quarantine_reason=quarantine_reason,
                received_at=received_at,
            ))
            await db.commit()
            return

        tenant_id = station.tenant_id
        farm_id = station.farm_id
        plot_id = station.plot_id
        observed_at = parse_datetime(payload.get("observed_at"))

        # Process Status Payload
        if msg_type == "status":
            battery_pct = payload.get("battery_pct")
            battery_voltage = payload.get("battery_voltage")
            rssi_dbm = payload.get("rssi_dbm")
            uptime_seconds = payload.get("uptime_seconds")
            firmware_version = payload.get("firmware_version")
            status_val = payload.get("status", "ONLINE")

            db.add(DeviceHealthHistory(
                tenant_id=tenant_id,
                station_id=station.id,
                battery_pct=battery_pct,
                battery_voltage=battery_voltage,
                rssi_dbm=rssi_dbm,
                uptime_seconds=uptime_seconds,
                firmware_version=firmware_version,
                status=status_val,
                recorded_at=observed_at,
            ))
            db.add(RawMqttMessage(
                tenant_id=tenant_id,
                station_id=station.id,
                topic=topic,
                message_id=message_id,
                payload=payload,
                validation_status="VALID",
                quarantine_reason=None,
                received_at=received_at,
            ))
            await db.commit()
            logger.info(f"Recorded health status for {station.display_name} ({status_val})")
            return

        # Process Weather Readings
        if msg_type == "weather":
            readings_dict = payload.get("readings", {})
            for key, item in readings_dict.items():
                if isinstance(item, dict):
                    raw_val = item.get("value")
                    unit_val = item.get("unit", "")
                    quality_val = item.get("quality", "valid")
                else:
                    raw_val = float(item) if item is not None else None
                    unit_val = METRIC_RANGE_LIMITS.get(key, (0, 0, ""))[2]
                    quality_val = "valid"

                # Check range limits
                if raw_val is not None and key in METRIC_RANGE_LIMITS:
                    min_v, max_v, default_u = METRIC_RANGE_LIMITS[key]
                    if not (min_v <= raw_val <= max_v):
                        quality_val = "out_of_bounds"
                    if not unit_val:
                        unit_val = default_u

                db.add(SensorReading(
                    tenant_id=tenant_id,
                    farm_id=farm_id,
                    plot_id=plot_id,
                    station_id=station.id,
                    sensor_id=None,
                    publisher_type="WEATHER_STATION",
                    sensor_type="WEATHER",
                    metric_key=key,
                    raw_value=raw_val,
                    normalized_value=raw_val,
                    unit=unit_val,
                    quality=quality_val,
                    observed_at=observed_at,
                    received_at=received_at,
                    message_id=message_id,
                ))

            db.add(RawMqttMessage(
                tenant_id=tenant_id,
                station_id=station.id,
                topic=topic,
                message_id=message_id,
                payload=payload,
                validation_status="VALID",
                quarantine_reason=None,
                received_at=received_at,
            ))
            await db.commit()
            logger.info(f"Ingested {len(readings_dict)} weather metrics for {station.display_name}")
            return

        # Process Soil Sensor Readings
        if msg_type == "soil" or len(parts) >= 7 and parts[5] == "soil":
            sensor_code = payload.get("sensor_id") or (parts[6] if len(parts) >= 7 else None)
            sensor = None
            if sensor_code:
                sensor = await db.scalar(
                    select(Device).where(
                        (Device.device_code == sensor_code) | (Device.id == sensor_code if len(sensor_code) == 36 else False),
                        Device.kind == DeviceKind.SOIL_SENSOR,
                    )
                )

            if not sensor:
                quarantine_reason = f"Soil Sensor '{sensor_code}' not found in registry"
                logger.warning(quarantine_reason)
                db.add(RawMqttMessage(
                    tenant_id=tenant_id,
                    station_id=station.id,
                    topic=topic,
                    message_id=message_id,
                    payload=payload,
                    validation_status="QUARANTINED",
                    quarantine_reason=quarantine_reason,
                    received_at=received_at,
                ))
                await db.commit()
                return

            # Check active sensor assignment at observed_at
            assignment = await db.scalar(
                select(SensorAssignment).where(
                    SensorAssignment.sensor_id == sensor.id,
                    SensorAssignment.valid_from <= observed_at,
                    (SensorAssignment.valid_to.is_(None) | (SensorAssignment.valid_to >= observed_at)),
                ).order_by(desc(SensorAssignment.valid_from)).limit(1)
            )

            sensor_plot_id = assignment.plot_id if assignment else (sensor.plot_id or plot_id)

            # Get latest calibration record for formula calculation
            cal_record = await db.scalar(
                select(CalibrationRecord).where(
                    CalibrationRecord.sensor_id == sensor.id,
                    CalibrationRecord.calibrated_at <= observed_at,
                ).order_by(desc(CalibrationRecord.calibrated_at)).limit(1)
            )

            scale_a = cal_record.scale_factor if cal_record and cal_record.scale_factor is not None else 1.0
            offset_b = cal_record.offset_value if cal_record and cal_record.offset_value is not None else 0.0

            readings_dict = payload.get("readings", {})
            for key, item in readings_dict.items():
                if isinstance(item, dict):
                    raw_val = item.get("value")
                    unit_val = item.get("unit", "")
                    quality_val = item.get("quality", "valid")
                else:
                    raw_val = float(item) if item is not None else None
                    unit_val = METRIC_RANGE_LIMITS.get(key, (0, 0, ""))[2]
                    quality_val = "valid"

                # Calculate normalized value using calibration formula y = ax + b
                norm_val = None
                if raw_val is not None:
                    # Apply calibration especially on moisture, EC, pH
                    if key in ("soil_moisture", "soil_ec", "soil_ph") and (scale_a != 1.0 or offset_b != 0.0):
                        norm_val = round((scale_a * raw_val) + offset_b, 2)
                        quality_val = "calculated"
                    else:
                        norm_val = raw_val

                    # Range validation
                    if key in METRIC_RANGE_LIMITS:
                        min_v, max_v, default_u = METRIC_RANGE_LIMITS[key]
                        if not (min_v <= norm_val <= max_v):
                            quality_val = "out_of_bounds"
                        if not unit_val:
                            unit_val = default_u

                db.add(SensorReading(
                    tenant_id=tenant_id,
                    farm_id=farm_id,
                    plot_id=sensor_plot_id,
                    station_id=station.id,
                    sensor_id=sensor.id,
                    publisher_type="SOIL_SENSOR",
                    sensor_type=sensor.soil_sensor.sensor_type if sensor.soil_sensor else "SOIL_7_IN_1",
                    metric_key=key,
                    raw_value=raw_val,
                    normalized_value=norm_val,
                    unit=unit_val,
                    quality=quality_val,
                    observed_at=observed_at,
                    received_at=received_at,
                    message_id=message_id,
                ))

            db.add(RawMqttMessage(
                tenant_id=tenant_id,
                station_id=station.id,
                topic=topic,
                message_id=message_id,
                payload=payload,
                validation_status="VALID",
                quarantine_reason=None,
                received_at=received_at,
            ))
            await db.commit()
            logger.info(f"Ingested {len(readings_dict)} soil metrics for {sensor.display_name} (Calibrated scale={scale_a}, offset={offset_b})")


class MqttIngestorWorker:
    def __init__(self, loop: asyncio.AbstractEventLoop):
        self.loop = loop
        self.client = mqtt_client.Client(mqtt_client.CallbackAPIVersion.VERSION2, client_id="durisense_ingestor_worker")
        self.client.on_connect = self.on_connect
        self.client.on_message = self.on_message
        self.client.on_disconnect = self.on_disconnect

    def on_connect(self, client, userdata, flags, reason_code, properties=None):
        if reason_code == 0:
            logger.info(f"Connected to Mosquitto Broker at {MQTT_HOST}:{MQTT_PORT}")
            client.subscribe(MQTT_TOPIC_ROOT, qos=1)
            logger.info(f"Subscribed to topic pattern: {MQTT_TOPIC_ROOT}")
        else:
            logger.error(f"Failed to connect to MQTT broker: reason_code={reason_code}")

    def on_disconnect(self, client, userdata, flags, reason_code, properties=None):
        logger.warning(f"Disconnected from MQTT broker: reason_code={reason_code}")

    def on_message(self, client, userdata, message):
        topic = message.topic
        payload = message.payload
        asyncio.run_coroutine_threadsafe(process_mqtt_message(topic, payload), self.loop)

    def start(self):
        while True:
            try:
                logger.info(f"Connecting to MQTT broker at {MQTT_HOST}:{MQTT_PORT}...")
                self.client.connect(MQTT_HOST, MQTT_PORT, keepalive=60)
                self.client.loop_start()
                break
            except Exception as e:
                logger.warning(f"MQTT connect retry in 3s: {e}")
                import time
                time.sleep(3)


async def main():
    loop = asyncio.get_running_loop()
    worker = MqttIngestorWorker(loop)
    worker.start()
    logger.info("MQTT Ingestion Service is running...")
    while True:
        await asyncio.sleep(3600)


if __name__ == "__main__":
    asyncio.run(main())
