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

## สถานะ

ชุดเอกสารออกแบบและ Phase 1A Frontend Foundation เสร็จแล้ว ปัจจุบัน Phase 1B
มี FastAPI, PostgreSQL migration และ Identity/Isolation flow ที่ทำงานจริง ส่วน MQTT runtime
และ Simulator ยังอยู่ใน milestone ถัดไป สถานะ implementation ติดตามใน `docs/ROADMAP.md`

## ลำดับการดำเนินงาน

เลข Phase ใช้ตาม `structure.md` และแตก milestone ภายใน Phase 1 เพื่อให้ติดตามงานได้จริง:

1. Phase 1A: Frontend Foundation — เสร็จแล้ว
2. Phase 1B: Account activation, Admin approval และ tenant isolation — กำลังดำเนินการ
3. Phase 1C: Farm, Plot, Weather Station, Soil Sensor และ assignment history
4. Phase 1D: MQTT ingestion, TimescaleDB, Simulator และ Farmer dashboard
5. Phase 1E: Relay command, ACK, audit, Admin queue และ offline alert
6. Phase 2: Field Operations — alerts, calibration, activity log, report/export และ device health
7. Phase 3: Research and Automation — dataset governance, analytics และ safe automation

สถานะล่าสุดและ Definition of Done อยู่ที่ [Canonical Roadmap](../ROADMAP.md)
