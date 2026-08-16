# DuriSense Canonical Roadmap

เอกสารนี้เป็นแผนดำเนินการและสถานะจริงของโครงการ โดยใช้หลักอ้างอิงดังนี้:

1. `prompt.md` เป็นข้อกำหนดผลิตภัณฑ์ ความปลอดภัย โครงสร้างข้อมูล และ acceptance criteria
2. `structure.md` เป็นสถาปัตยกรรมและชื่อ Phase หลักของโครงการ
3. `docs/phase-*` เป็นบันทึกงานที่ส่งมอบ ไม่ใช้กำหนดเลข Phase ใหม่

## สถานะปัจจุบัน

วันที่ตรวจสถานะ: 16 สิงหาคม 2026

| Phase / Milestone | สถานะ | ขอบเขต |
| --- | --- | --- |
| Preparation: Architecture | เสร็จ | Requirement, ADR, architecture, data model, MQTT/API/screen contract และ UI direction |
| Phase 1A: Frontend Foundation | เสร็จ | Scaffold, tokens, Landing/About/Guide, Authentication UI states, Reset Password และ Profile simulation |
| Phase 1B: Identity and Isolation | เสร็จ | Identity, Admin approval UI, SMTP outbox, MFA lifecycle, RBAC และ tenant isolation ใช้งานและทดสอบแล้ว |
| Phase 1C: Farm and Device Registry | ยังไม่เริ่ม | Farm, Plot, Weather Station, Soil Sensor, assignment history และ decommission |
| Phase 1D: Telemetry Vertical Slice | ยังไม่เริ่ม | Mosquitto, MQTT ingestion, validation, TimescaleDB, simulator และ Farmer dashboard |
| Phase 1E: Relay and Admin Vertical Slice | ยังไม่เริ่ม | Relay command/ACK/state, audit และ offline alert โดยต่อยอด Admin workspace จาก Phase 1B |
| Phase 2: Field Operations | ยังไม่เริ่ม | Alert rules, notification preference, calibration, data quality, activity/irrigation log, export/report และ device health |
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

### Phase 1C: Farm and Device Registry

- Farm/Plot CRUD และ membership
- Weather Station/Soil Sensor registry
- `SOIL_TH`/`SOIL_7_IN_1`, assignment/reassignment history และ calibration metadata
- Device credential lifecycle และ decommission โดยรักษาประวัติ

### Phase 1D: Telemetry Vertical Slice

- Eclipse Mosquitto MQTT/TLS และ ACL รายอุปกรณ์
- Legacy adapter, Batch `2.0-batch` และ Production payload `2.0`
- Validation, normalization, quarantine, deduplication และ TimescaleDB storage
- Sensor Simulator และ Dashboard ที่มี latest/series/quality/offline states

### Phase 1E: Relay and Admin Vertical Slice

- Relay 1-4 naming และ permission check
- Command, expiry, ACK, reported state, timeout และ state mismatch
- Relay Simulator, audit trail, Admin user approval queue และระบบแจ้งเตือน offline ขั้นต่ำ

## Phase 2: Field Operations

เริ่มหลัง Phase 1 vertical slice ผ่าน integration/security tests แล้วเท่านั้น:

- Alert rules และ notification preference
- Calibration workflow และ data quality operations
- Farm activity/irrigation log
- CSV/XLSX export และรายงาน
- Device health และ data-gap report

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
