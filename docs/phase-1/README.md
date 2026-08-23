# DuriSense Phase 1: System Design

เอกสารชุดนี้เป็นผลส่งมอบระยะที่ 1 ของระบบบริการจัดการแปลงทุเรียน DuriSense
โดยสรุปข้อกำหนดจาก `structure.md` และ `prompt.md` ให้อยู่ในรูปที่พร้อมใช้พัฒนาระบบ
ทีละระยะ

## ข้อมูลโครงการ

- ชื่อระบบ: DuriSense
- ผู้ออกแบบระบบ: Parinya Jansengrat
- หน่วยงาน: มหาวิทยาลัยเทคโนโลยีราชมงคลธัญบุรี
- Brand asset: `logo.png` ที่ root ของโครงการ
- แนวทางระยะแรก: Sensor Simulator และ Relay Simulator ที่ใช้ contract เดียวกับฮาร์ดแวร์จริง

## เอกสารในระยะนี้

1. [Requirement และขอบเขต](./01-requirements-and-scope.md)
2. [Architecture Decision Records](./02-architecture-decisions.md)
3. [System Architecture](./03-system-architecture.md)
4. [Data Model](./04-data-model.md)
5. [MQTT และ Simulator Contract](./05-mqtt-and-simulator-contract.md)
6. [API และ Screen Contract](./06-api-and-screen-contract.md)
7. [UI Direction ด้วย Gridgeist](./07-ui-direction.md)
8. [Phase 1B Delivery](./08-phase-1b-delivery.md)
9. [Phase 1C Delivery](./09-phase-1c-progress.md)
10. [Phase 1D Delivery](./10-phase-1d-delivery.md)
11. [Phase 1E Delivery](./11-phase-1e-delivery.md)

## สถานะ

ชุดเอกสารออกแบบ, Phase 1A Frontend Foundation, Phase 1B Identity and Isolation, Phase 1C Farm and Device Registry, Phase 1D Telemetry Processing, และ Phase 1E Relay Control & Activity Tracking เสร็จสมบูรณ์แล้ว 100%
ระบบมี FastAPI, PostgreSQL migration, Mosquitto MQTT Broker, Ingestion Engine, Field Simulator, Telemetry Dashboards, Relay Control Center, และ Farm Activity Journal ที่ทำงานจริง 100%
สถานะ implementation ล่าสุดติดตามใน `docs/ROADMAP.md`

## ลำดับการดำเนินงาน

เลข Phase ใช้ตาม `structure.md` และแตก milestone ภายใน Phase 1 เพื่อให้ติดตามงานได้จริง:

1. Phase 1A: Frontend Foundation — เสร็จแล้ว
2. Phase 1B: Account activation, Admin approval และ tenant isolation — เสร็จแล้ว
3. Phase 1C: Farm, Plot, Weather Station, Soil Sensor, Calibration และ assignment history — เสร็จแล้ว
4. Phase 1D: MQTT ingestion, TimescaleDB, Simulator, Telemetry Dashboard & Interactive Charts — เสร็จแล้ว
5. Phase 1E: Relay Control Center, MQTT Commands, Pulse Timers & Farm Activity Journal — เสร็จแล้ว
6. Phase 2: Alert Rules & Field Operations — ถัดไป
7. Phase 3: Research and Automation — dataset governance, analytics และ safe automation

สถานะล่าสุดและ Definition of Done อยู่ที่ [Canonical Roadmap](../ROADMAP.md)
