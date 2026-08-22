# Phase 1C Progress: Farm and Device Registry

ตรวจสถานะล่าสุด: 22 สิงหาคม 2026

เอกสารนี้เป็นบันทึกต่อเนื่องของ Phase 1C เพื่อให้กลับมาพัฒนาต่อได้โดยไม่ต้องอาศัยความจำจากบทสนทนา
สถานะสรุประดับโครงการยังคงยึด [Canonical Roadmap](../ROADMAP.md) เป็นหลัก

## ส่งมอบแล้ว

### Backend และฐานข้อมูล

- เพิ่ม domain `registry` แยกจาก Identity
- เพิ่ม `farms`, `farm_memberships`, `plots`, `devices`, `weather_stations`, `soil_sensors`,
  `sensor_assignments`, `device_credentials`, `decommission_records` และ `calibration_records`
- เพิ่ม Alembic revision `20260820_06` สำหรับ schema, `20260820_07` สำหรับ backfill สวนของบัญชีเดิม และ `20260822_08` สำหรับ `calibration_records`
- การสมัครสมาชิกใหม่สร้าง Farm และ owner membership พร้อม Tenant เดิมโดยอัตโนมัติ
- Farm/Plot create, list, read, update และ archive ภายใต้ membership scope
- Weather Station และ Soil Sensor create, list, read, update และ decommission
- Soil Sensor รองรับ `SOIL_TH`, `SOIL_7_IN_1` และ Modbus address 1-247
- ระบบ Calibration Metadata: API `POST /soil-sensors/{sensor_id}/calibrations` และ `GET /soil-sensors/{sensor_id}/calibrations` สำหรับบันทึกค่าชดเชย offset, scale factor, temperature compensation และสูตรสอบเทียบ
- Assignment ใหม่ปิดช่วง assignment ปัจจุบันก่อนสร้างประวัติรายการใหม่ และป้องกันช่วงเวลาเริ่มต้นย้อนทับ
- Weather Station credential rotation revoke credential เดิม แสดง secret ใหม่ครั้งเดียว และจัดเก็บเฉพาะ keyed hash
- Decommission เป็น soft lifecycle: เปลี่ยนสถานะอุปกรณ์, revoke credential, ปิด assignment และเพิ่ม audit/decommission record
- Resource ข้าม farm/tenant คืน 404 เพื่อลด IDOR/resource enumeration
- Mutation ทุก endpoint ใช้ session, CSRF และ Origin validation เดิมจาก Phase 1B
- เพิ่ม Farm Membership API สำหรับ list, เพิ่มด้วยอีเมล, เปลี่ยนบทบาท และถอนสิทธิ์แบบ soft revoke
- Permission matrix: OWNER กำหนด MANAGER/MEMBER/TECHNICIAN ได้, MANAGER จัดการได้เฉพาะ MEMBER/TECHNICIAN,
  ห้ามแก้ membership ของตนเองหรือเปลี่ยน OWNER ผ่าน flow นี้ และสงวน ownership transfer ไว้เป็น workflow แยก

### Frontend

- เพิ่ม Farmer workspace ที่มี navigation แยกจาก Admin
- เพิ่ม `/farms` สำหรับเลือกสวน ดูแปลง เพิ่มสวน, เพิ่มแปลง, แก้ไขข้อมูลสวน, จัดเก็บสวน (Archive Farm), แก้ไขแปลง และจัดเก็บแปลง (Archive Plot)
- เพิ่ม `/devices` สำหรับลงทะเบียน Weather Station/Soil Sensor, แก้ไขชื่อเรียก/แปลง/เฟิร์มแวร์อุปกรณ์, กำหนด assignment, ดูประวัติ assignment ย้อนหลัง, บันทึกและดูประวัติการสอบเทียบเซนเซอร์ดิน (Calibration), ออก credential และเริ่ม decommission flow พร้อมคำเตือนผลกระทบ
- เปลี่ยน Farmer login destination จาก `/profile` เป็น `/farms`
- ใช้ข้อมูล API จริง ไม่มี farm/device metrics จำลอง
- รองรับ loading, empty, error, success, disabled และ destructive confirmation states
- ตรวจ viewport 1280x800 และ 360x800; mobile ไม่มี horizontal overflow และ control ที่ตรวจมีความสูงอย่างน้อย 44px
- เพิ่มส่วนจัดการสมาชิกใน `/farms` ตามสวนที่เลือก พร้อม add-by-email, role selector, revoke confirmation และสถานะสิทธิ์ของผู้ใช้
- ซ่อนปุ่มจัดการแปลงและสวนจาก MEMBER/TECHNICIAN ให้ตรงกับ backend permission
- หน้า `/devices` แสดงเฉพาะอุปกรณ์ `ACTIVE` ในรายการหลัก และย้าย `DECOMMISSIONED` ไปไว้ในส่วนประวัติที่เปิด–ปิดได้
- เมื่อยกเลิก Weather Station ที่กำลังแสดง one-time credential ระบบล้าง secret นั้นออกจากหน้าจอทันที

## การตรวจสอบล่าสุด

- `npm.cmd run lint` — ผ่าน
- `npm.cmd run typecheck` — ผ่าน
- `npm.cmd run build` — ผ่าน รวม route `/farms` และ `/devices` ทั้งหมด 16 routes
- Backend tests — เพิ่มครอบคลุม Soil Sensor Calibration workflow และ Farm/Plot/Device Edit & Archive workflow
- PostgreSQL migration — `20260822_08 (head)` และพบตารางครบ 10 ตารางใน registry domain

## ก้าวถัดไป: Phase 1D (Telemetry Vertical Slice)

1. ตั้งค่า Eclipse Mosquitto MQTT/TLS (Port 8883) พร้อม per-device authentication และ topic ACL
2. พัฒนา MQTT Ingestion Service สำหรับ validate payload, enrich metadata ตาม sensor assignment และบันทึกลง TimescaleDB Hypertables
3. พัฒนา Device Simulator สำหรับ Weather Station และ Soil Sensor
4. พัฒนา Real-time Farmer Dashboard ใน Frontend สำหรับแสดง Telemetry ค่าสภาพอากาศและดิน
