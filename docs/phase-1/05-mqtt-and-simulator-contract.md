# MQTT และ Simulator Contract

## Topic Convention

```text
durian/{tenant_id}/{farm_id}/{plot_id}/{station_id}/weather
durian/{tenant_id}/{farm_id}/{plot_id}/{station_id}/soil/{sensor_id}
durian/{tenant_id}/{farm_id}/{plot_id}/{station_id}/status
durian/{tenant_id}/{farm_id}/{plot_id}/{station_id}/event
durian/{tenant_id}/{farm_id}/{plot_id}/{station_id}/relay/command
durian/{tenant_id}/{farm_id}/{plot_id}/{station_id}/relay/command_ack
durian/{tenant_id}/{farm_id}/{plot_id}/{station_id}/relay/state
```

## Broker Policy

- MQTT over TLS ที่ `8883/TCP`; ปิด anonymous และไม่เปิด `1883`
- Weather Station/Gateway มี credential แยกรายอุปกรณ์
- Publish ได้เฉพาะ weather, soil, status, event, ACK และ state ภายใต้ station prefix ของตน
- Subscribe ได้เฉพาะ relay command/config ที่อนุญาตภายใต้ station prefix ของตน
- QoS 1 สำหรับ telemetry/command/ACK; retained ใช้กับ status/state snapshot ตามที่กำหนด
- LWT ใช้ประกาศสถานะ offline
- กำหนด message size, rate, connection และ inflight limits

## Production Weather Payload 2.0

```json
{
  "schema_version": "2.0",
  "message_id": "01JZ7C2M6Q8V4K1T9H3R5N0PXB",
  "plot_id": "plot_01",
  "station_id": "ws_001",
  "sequence": 8801,
  "observed_at": "2026-06-25T14:30:00+07:00",
  "readings": {
    "air_temperature": { "value": 31.5, "unit": "degC", "quality": "valid" },
    "air_relative_humidity": { "value": 68.2, "unit": "%RH", "quality": "valid" },
    "wind_speed_avg_5m": { "value": 1.2, "unit": "m/s", "quality": "valid" },
    "wind_direction_deg": { "value": 180, "unit": "degree", "quality": "valid" },
    "illuminance": { "value": 45000, "unit": "lux", "quality": "valid" }
  }
}
```

## Production Soil Payload 2.0

```json
{
  "schema_version": "2.0",
  "message_id": "01JZ7C2M6Q8V4K1T9H3R5N0PXC",
  "plot_id": "plot_01",
  "station_id": "ws_001",
  "sensor_id": "soil_002",
  "sensor_type": "SOIL_7_IN_1",
  "sequence": 5320,
  "observed_at": "2026-06-25T14:29:58+07:00",
  "readings": {
    "soil_temperature": { "value": 28.3, "unit": "degC", "quality": "valid" },
    "soil_moisture": { "value": 44.2, "unit": "%", "quality": "valid" },
    "soil_ec": { "value": 1200, "unit": "uS/cm", "quality": "valid" },
    "soil_ph": { "value": 6.5, "unit": "pH", "quality": "valid" },
    "soil_n": { "value": 40, "unit": "mg/kg", "quality": "valid" },
    "soil_p": { "value": 20, "unit": "mg/kg", "quality": "valid" },
    "soil_k": { "value": 30, "unit": "mg/kg", "quality": "valid" }
  }
}
```

## Validation Rules

- Identity จาก authenticated MQTT connection ต้องตรง registry และ `station_id` ใน topic/payload
- Soil `sensor_id` ต้องมี assignment ที่ครอบคลุม `observed_at`
- ตรวจ metric allowlist ตาม `WEATHER`, `SOIL_TH` หรือ `SOIL_7_IN_1`
- ตรวจ type, unit, range, timestamp, schema version และ message size
- `value: null` พร้อม quality/error ใช้แทนข้อมูลอ่านไม่ได้; ห้ามใช้ `0` แทน missing
- Deduplicate ด้วย `message_id`; ใช้ sequence ตรวจ gap/order เพิ่มเติม
- ข้อความไม่ผ่าน validation เข้า quarantine พร้อมเหตุผล ไม่ปะปนกับ normalized readings

## Relay Command

```json
{
  "schema_version": "1.0",
  "command_id": "cmd_01JXYZ123",
  "type": "SET_RELAY",
  "relay_channel": 1,
  "desired_state": "ON",
  "issued_at": "2026-08-07T14:30:00+07:00",
  "expires_at": "2026-08-07T14:30:15+07:00"
}
```

ACK ต้องส่ง `command_id`, `accepted`, `relay_channel`, `reported_state`, `executed_at`,
`error_code` และ optional `message` เมื่อ reconnect อุปกรณ์ต้อง publish state snapshot ของทั้ง 4 ช่อง

## Simulator Design

Sensor Simulator ต้องรองรับ:

- Seeded deterministic scenario เพื่อให้ test ทำซ้ำได้
- Normal, stale, missing, out-of-range, duplicate, out-of-order และ offline scenario
- WEATHER, SOIL_TH และ SOIL_7_IN_1
- ปรับ sampling interval, station/sensor count และ disconnect/reconnect
- Publish Schema `2.0` เป็นหลัก และ Legacy/Batch เฉพาะ compatibility tests

Relay Simulator ต้องรองรับ:

- Subscribe command และ publish ACK/state บน topic จริง
- Success, rejected, delayed ACK, timeout, expired และ state mismatch scenario
- Boot/reconnect state snapshot และ default state `OFF`
- ไม่เปลี่ยน state เมื่อคำสั่งหมดอายุหรือ payload ไม่ถูกต้อง

## Hardware Compatibility Gate

ฮาร์ดแวร์จริงเชื่อมได้เมื่อผ่าน TLS/ACL, clock/timezone, schema validation, offline/reconnect,
command expiry, ACK correlation, state snapshot, fail-safe และ electrical field test โดยไม่ต้องเพิ่ม endpoint
หรือ topic สำหรับ hardware แยกจาก simulator

