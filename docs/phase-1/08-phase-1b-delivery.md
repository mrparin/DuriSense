# Phase 1B Delivery: Identity and Isolation

ตรวจสถานะล่าสุด: 16 สิงหาคม 2026

## Implemented

- FastAPI `/api/v1` พร้อม OpenAPI, error envelope, request ID และ security headers
- PostgreSQL runtime และ Alembic migrations `20260816_01` ถึง `20260816_05`
- Account states `PENDING_VERIFICATION`, `ACTIVE`, `REJECTED`, `SUSPENDED`
- Activation ผ่าน email token หรือ Admin approval พร้อม provenance fields และ status history
- Argon2id password, opaque server-side session, CSRF/Origin protection และ session rotation/revocation
- Login throttling, account lockout, login history, one-time hashed token และ generic recovery response
- Admin provisioning CLI, TOTP enrollment/rotation และ recovery code แบบใช้ครั้งเดียว โดยเก็บ secret แบบเข้ารหัสและ code เป็น hash
- Role + permission RBAC, role change audit และ session revocation หลัง privilege change
- Tenant/Membership scope ที่หา tenant จาก authenticated user และคืน 404 สำหรับ cross-tenant access
- Encrypted transactional email outbox, SMTP worker, exponential retry, delivery status และ Mailpit สำหรับ local delivery evidence
- Next.js Authentication/Profile และ Admin workspace เชื่อม API ผ่าน same-origin rewrite

## Verification

- Backend pytest: 6 tests ผ่าน ครอบคลุม activation, token reuse, CSRF, reset revocation,
  Admin MFA rotation/recovery/approval, encrypted outbox delivery, lockout และ cross-tenant IDOR
- PostgreSQL migration ทำงานจริง และ container `db`/`api` ผ่าน health check
- Frontend lint, TypeScript และ production build ผ่าน 14 routes รวม `/admin/users` และ `/admin/security`
- Browser flow ผ่าน: register -> verify email -> login -> load/update profile
- Responsive inspection ที่ 1715px และ 390px ไม่พบ horizontal overflow

## Completion

Phase 1B ปิดเป็นเสร็จแล้ว งานถัดไปคือ Phase 1C เพื่อสร้าง Farm/Plot/Station/Sensor registry และเพิ่ม farm-level isolation test ส่วน TLS, secure cookie, production SMTP credential, secret injection และ restore drill ต้องยืนยันอีกครั้งใน University Production Readiness Gate ก่อนเปิดระบบจริง

## Architecture Note

Active sessions ระยะแรกเก็บใน PostgreSQL เพื่อให้ migration, revoke และ security history
ทำงานเป็น transaction เดียวกัน Redis จะเพิ่มเมื่อมีหลักฐานด้าน latency/scale โดยไม่เปลี่ยน
opaque cookie contract
