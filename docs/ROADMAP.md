# DuriSense Canonical Roadmap

เอกสารนี้เป็นแผนดำเนินการและสถานะจริงของโครงการ โดยใช้หลักอ้างอิงดังนี้:

1. `prompt.md` เป็นข้อกำหนดผลิตภัณฑ์ ความปลอดภัย โครงสร้างข้อมูล และ acceptance criteria
2. `structure.md` เป็นสถาปัตยกรรมและชื่อ Phase หลักของโครงการ
3. `docs/phase-*` เป็นบันทึกงานที่ส่งมอบ ไม่ใช้กำหนดเลข Phase ใหม่

## สถานะปัจจุบัน

วันที่ตรวจสถานะ: 23 สิงหาคม 2026

| Phase / Milestone | สถานะ | ขอบเขต |
| --- | --- | --- |
| Preparation: Architecture | เสร็จ | Requirement, ADR, architecture, data model, MQTT/API/screen contract และ UI direction |
| Phase 1A: Frontend Foundation | เสร็จ | Scaffold, tokens, Landing/About/Guide, Authentication UI states, Reset Password และ Profile simulation |
| Phase 1B: Identity and Isolation | เสร็จ | Identity, Admin approval UI, SMTP outbox, MFA lifecycle, RBAC และ tenant isolation ใช้งานและทดสอบแล้ว |
| Phase 1C: Farm and Device Registry | เสร็จ | Registry, Farm membership, Calibration metadata, Edit/Archive UI ครบทุก flow |
| Phase 1D: Telemetry Vertical Slice | เสร็จ | Mosquitto, MQTT ingestion, validation, TimescaleDB, simulator, Farmer dashboard และ Admin monitor |
| Phase 1E: Relay Control and Activity Tracking | เสร็จ | Relay command/ACK, pulse timers, 4-channel control, audit trail และ farm activity logs |
| Phase 2A: Alert Rules & Notifications | เสร็จ | กฎเตือนภัย, hysteresis/debounce, วงจรชีวิตเหตุการณ์ (Open/Ack/Resolve), In-app bell, quiet hours และ preferences |
| Phase 2B: Device Health & Data Gap | เสร็จ | ตรวจจับสถานีออฟไลน์, รายงานข้อมูลขาดช่วง (Data gap report), data quality, battery/RSSI health |
| Phase 2C: Export & Summary Reports | ถัดไป | ส่งออกข้อมูล CSV/XLSX, รายงานสรุปภาพรวมรายวัน/สัปดาห์/เดือน |
| Phase 3: Research and Automation | ยังไม่เริ่ม | Dataset governance, analytics, forecast/recommendation และ automation ที่ผ่าน risk assessment |

## Phase 1: Foundation and Vertical Slice

Phase 1 จะถือว่าเสร็จเมื่อ vertical slice ใน `prompt.md` และ `structure.md` ทำงานจริงครบตั้งแต่
สมัครสมาชิกจนถึงรับ telemetry, แสดง Dashboard, ส่งคำสั่งรีเลย์, รับ ACK/reported state
และแยกสิทธิ์ข้อมูลระหว่างสวนได้

### Phase 1A: Frontend Foundation — Complete

- Next.js App Router, TypeScript, design tokens และ responsive public UI
- Landing page ที่ไม่เปิดเผยข้อมูลสวน พร้อมข้อมูลแพลตฟอร์ม อุปกรณ์ คู่มือ และช่องทางติดต่อ
- Login, Register, Verify Email, Registration Status, Forgot/Reset Password และ Profile UI
- UI states ตาม screen contract: loading, success, invalid, pending, active, rejected, suspended และ rate-limited
- ณ วันที่ปิด Phase 1A ทุก flow เป็น simulation; Phase 1B ได้แทนที่ Authentication/Profile ด้วย API จริงแล้ว

### Phase 1B: Identity and Isolation — Complete

ส่งมอบแล้ว:

- FastAPI application, error envelope, request ID, health check และ OpenAPI contract
- PostgreSQL + Alembic migrations สำหรับ user, role, permission, session, token, account status, tenant, membership, audit และ email outbox
- Register, email verification, Admin approval/reject/suspend, login/logout, session rotation, reset password และ profile
- Opaque HttpOnly session cookie, CSRF + Origin check, Argon2id, encrypted Admin TOTP secret, rate limit, lockout และ login history
- Permission-backed RBAC, role reassignment พร้อม revoke session และ tenant isolation test ที่คืน 404 เมื่อข้าม tenant
- Frontend Authentication/Profile เชื่อม API จริงผ่าน same-origin rewrite และผ่าน browser flow บน desktop/mobile
- SMTP worker จาก encrypted transactional outbox พร้อม exponential retry, delivery status และ Mailpit สำหรับหลักฐานใน local environment
- Admin provisioning CLI, TOTP enrollment/rotation, one-time recovery code และ session revocation หลังหมุน MFA
- Admin workspace สำหรับดูคิวสมาชิก อนุมัติ ปฏิเสธ และจัดการความปลอดภัย บน desktop/mobile

งานที่ย้ายไป milestone ที่มี dependency ถูกต้อง:

- Farm-level isolation test อยู่ใน Definition of Done ของ Phase 1C หลังมี `farms`/`farm_memberships`
- Production ingress, secure cookie/TLS, secret injection และ database restore เป็น University Production Readiness Gate ก่อน deploy จริง

### Phase 1C: Farm and Device Registry — Complete

ส่งมอบแล้ว:

- Farm และ Plot create/read/update/archive พร้อม farm membership scope และ cross-tenant 404
- Weather Station/Soil Sensor create/read/update/list รองรับ `SOIL_TH`/`SOIL_7_IN_1`
- Sensor assignment/reassignment แบบปิดช่วงเดิมและรักษาประวัติการติดตั้ง
- Weather Station credential rotation ที่แสดง secret ครั้งเดียวและเก็บเฉพาะ hash
- Device decommission ที่ revoke credential, ปิด assignment และรักษา audit/decommission history
- Farmer workspace `/farms` และ `/devices` เชื่อม API จริง รองรับ loading, empty, error, success และ destructive confirmation
- Farm membership list/add-by-email/role/revoke พร้อม OWNER/MANAGER permission matrix และหน้าจอ responsive
- Calibration metadata & record workflow: ตาราง `calibration_records`, API `POST`/`GET` สำหรับสอบเทียบเซนเซอร์ดิน พร้อม UI บันทึกและดูประวัติ
- UI Edit & Archive ครบวงจรสำหรับ Farm, Plot, Device (display name, plot, firmware) และ Sensor assignment history view
- Alembic revision `20260822_08` สำหรับ `calibration_records` และ automated tests ครอบคลุมทั้งหมด 12 รายการ

### Phase 1D: Telemetry Data Processing & TimescaleDB Integration — Complete

ส่งมอบแล้ว:

- Eclipse Mosquitto 2.0 MQTT/TLS Broker (พอร์ต 1883/8883) พร้อม Docker Compose Integration
- Data Contracts สำหรับ WeatherPayloadV2, SoilPayloadV2 (7-in-1 NPK), DeviceStatusPayload และ Range Limits
- TimescaleDB Hypertables & Alembic migration `20260822_09_telemetry_hypertables` สำหรับ `sensor_readings`, `device_health_history`, `raw_mqtt_messages`
- MQTT Ingestor Engine พร้อม deduplication, validation, hardware calibration formula offset ($y = ax + b$), quarantine queue และ DB logging
- Field Simulator Service จำลองสภาพอากาศตามวงรอบดวงอาทิตย์ และโพรบวัดดิน 7-in-1 ครบทุกแปลงสตรีมข้อมูลสดทุก 10 วินาที
- Backend Telemetry APIs (`/telemetry/latest`, `/telemetry/series` รองรับ `15m`/`1h`/`1d` intervals, `/devices/{id}/health`, `/admin/telemetry/overview`)
- Frontend Farmer Dashboard (`/telemetry`): สภาพอากาศสดและสุขภาพดิน 7-in-1 ครบทุกแปลงทุเรียนในสวน
- Interactive SVG Chart UX Upgrades: Smooth Bézier Spline Curves, Area Gradient Shading, Glassmorphism Hover Tooltip, Auto-Downsampling (15m/1h/1d), Moving Average Filter และ Plot-by-Plot complete rendering
- Admin Telemetry Monitor (`/admin/telemetry`): Ingestion queue monitor, Raw MQTT stream inspection และ Quarantine audit
- Automated Tests (Pytest 14/14 passed) และ Frontend ESLint / TypeScript typecheck ผ่าน 0 errors

### Phase 1E: Operational Logs & Relay Control Center — Complete

ส่งมอบแล้ว:

- ตารางฐานข้อมูล `relay_channels`, `relay_commands`, `relay_command_events`, และ `farm_activities` พร้อม Alembic migration `20260823_10`
- REST APIs สำหรับ Relay Control (`/relays`, `/relays/{id}/command`) และ Farm Activity Logs (`/activities`)
- MQTT Relay Command Dispatcher: ส่งสัญญาณคำสั่งเปิด/ปิดไปยัง MQTT Broker และรองรับ Pulse Duration Timers (5m, 15m, 30m, 1h)
- Relay Control Center UI (`/relays`): ปุ่มควบคุมสวิตช์กำลังขนาดใหญ่ (Power Switch) พร้อมไฟ LED สัญลักษณ์ Real-Time 🟢 ON / ⚪ OFF / 🟡 PENDING, Floating Toast Notifications แบบมุมขวาล่าง, และประวัติสั่งการ
- Farm Activity Journal UI (`/activities`): บันทึกและติดตามประวัติการให้น้ำ ใส่ปุ๋ย ฉีดพ่นสารเคมี ตัดแต่งกิ่ง และผลผลิตเก็บเกี่ยวแบบ Timeline
- Pytest Unit Tests (`test_operations.py`) และ Frontend Lint/Typecheck ผ่าน 0 errors

## Phase 2: Field Operations

### Phase 2A: Alert Rules & Notification System — Complete

ส่งมอบแล้ว (10 ตุลาคม 2026):
- ตารางฐานข้อมูล `alert_rules`, `alert_events`, และ `notification_preferences` พร้อม Alembic migration `20260824_11`
- REST APIs สำหรับ Alert Rules CRUD, Event Lifecycle (`/alerts/events/{id}/acknowledge`, `/resolve`), Summary KPIs, และ User Notification Preferences
- Rule Evaluation Engine พร้อมเงื่อนไข `LESS_THAN`, `GREATER_THAN`, `OUT_OF_RANGE`, `OFFLINE_TIMEOUT` และกลไก Hysteresis / Deadband ป้องกันแจ้งเตือนซ้ำ
- Frontend Alerts Operations Center (`/alerts`): สรุป KPI, ไทม์ไลน์เหตุการณ์, จัดการและสร้างกฎใหม่ด้วย Modal, และการตั้งค่าช่องทางแจ้งเตือน/ช่วงเวลาเงียบ (Quiet Hours)
- Header Notification Bell 🔔: แสดงตัวเลข Badge เหตุการณ์ Open และ Dropdown Drawer เปิดดูแจ้งเตือนด่วนได้จากทุกหน้า
- Automated Tests (`test_alerts.py`) และ Frontend Lint/Typecheck ผ่าน 0 errors

### Phase 2B: Device Health & Data Gap — Complete

ส่งมอบแล้ว (28 ตุลาคม 2026):
- Schema & Data Models สำหรับ Device Health Detail, Farm Health Summary, Data Gap Report, และ Offline Check Result
- Backend Service & REST APIs:
  - `GET /api/v1/farms/{id}/health/summary`: สรุปภาพรวมสถานะอุปกรณ์ทั้งสวน (Online, Degraded, Offline, Low Battery, Weak RSSI)
  - `GET /api/v1/devices/{id}/health/detail`: ข้อมูลสุขภาพอุปกรณ์เชิงลึก พร้อมประวัติแบตเตอรี่ & RSSI ย้อนหลัง 50 รายการ
  - `GET /api/v1/farms/{id}/health/data-gaps`: ตรวจจับและแจกแจง Data Gaps พร้อมคำนวณอัตราความสมบูรณ์ของข้อมูล (Completeness Rate %)
  - `POST /api/v1/farms/{id}/health/check-offline`: ตรวจจับอุปกรณ์ที่ออฟไลน์ พร้อม Trigger/Resolve `OFFLINE_TIMEOUT` alerts โดยอัตโนมัติ
- Frontend UI:
  - `DeviceHealthCenter`: แดชบอร์ดติดตามสุขภาพสถานีตรวจวัดและเซนเซอร์ดิน พร้อมเกจวัดแบตเตอรี่และคุณภาพสัญญาณ RSSI
  - Data Gap Analytics View: ตัวกรองช่วงเวลา (24 ชม., 7 วัน, 30 วัน), การคำนวณ Data Completeness %, แถบ Visual Gap Timeline, ตารางแจกแจง Gap พร้อมฟังก์ชันส่งออก CSV
  - Deep-Dive Modal: ดูประวัติสถานะและเส้นทางสุขภาพของอุปกรณ์ย้อนหลัง
  - เชื่อมโยงเข้ากับ `/devices` ผ่าน `DevicesWorkspace`
- Automated Tests (`test_telemetry.py`) ครอบคลุม 7 รายการ และ Frontend Lint/Typecheck ผ่าน 0 errors

### Phase 2C: Export & Summary Reports — ถัดไป
- CSV / XLSX export ตามช่วงเวลาและแปลง
- รายงานสรุปภาพรวมรายวัน/สัปดาห์/เดือนของแต่ละสวน

## Phase 3: Research and Automation

- Dataset permission, anonymization และ provenance
- Derived metrics และ analytics ขั้นสูง
- Forecast/recommendation พร้อม confidence และเหตุผล
- Safe automation/scheduling หลังผ่าน risk assessment, interlock, maximum runtime,
  manual override และ feedback sensor

## Definition of Done

แต่ละ milestone ต้องมี implementation, automated checks/tests ตามความเสี่ยงและขอบเขต, browser verification,
security checks ที่เกี่ยวข้อง และเอกสารสถานะที่ระบุสิ่งที่ยังไม่เชื่อมจริง ห้ามเลื่อนสถานะเป็นเสร็จ
จาก UI Simulation หรือ placeholder เพียงอย่างเดียว
