# DuriSense

ระบบบริการจัดการแปลงทุเรียนอัจฉริยะ ออกแบบโดย Parinya Jansengrat
มหาวิทยาลัยเทคโนโลยีราชมงคลธัญบุรี

## Current Status

โครงการปิด **Phase 1B: Identity and Isolation** แล้ว และพร้อมเริ่ม **Phase 1C: Farm and Device Registry**
ระบบมี FastAPI, PostgreSQL migration, สมัคร/ยืนยัน/เข้าสู่ระบบ/กู้รหัสผ่าน, opaque session,
CSRF, Admin approval workspace, TOTP MFA + recovery code, SMTP outbox, permission-backed RBAC และ tenant isolation

ดูสถานะและลำดับงานที่ [Canonical Roadmap](./docs/ROADMAP.md)

## Requirements

- Node.js 20.9 ขึ้นไป
- npm 10 ขึ้นไป
- Docker Desktop พร้อม Docker Compose

## Run

```powershell
npm.cmd install
npm.cmd run dev
```

เปิด `http://localhost:3000`

เริ่ม PostgreSQL และ FastAPI:

```powershell
Copy-Item .env.example .env
npm.cmd run backend:up
```

API อยู่ที่ `http://127.0.0.1:8000` และ OpenAPI อยู่ที่ `http://127.0.0.1:8000/docs`
กล่องอีเมลทดสอบอยู่ที่ `http://127.0.0.1:8025`

## Check

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
npm.cmd run test:backend
```

## Repository Direction

```text
frontend/                  Next.js App Router + connected identity UI
backend/                   FastAPI identity/session/RBAC/tenant API
services/mqtt-ingestor/    MQTT ingestion (Phase 1D)
services/simulator/        Sensor and relay simulator (Phase 1D/1E)
packages/contracts/        Shared JSON/OpenAPI contracts
infrastructure/            Docker, Nginx, Mosquitto and TimescaleDB
docs/                      Architecture and delivery notes
tests/                     Cross-service integration and E2E tests
```

รายละเอียดสถาปัตยกรรมอยู่ใน [เอกสารออกแบบ](./docs/phase-1/README.md)
