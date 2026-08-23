# Phase 1D Delivery: Telemetry Processing & TimescaleDB Integration

**วันที่ส่งมอบ**: 23 สิงหาคม 2026  
**โครงการ**: DuriSense Portal  
**สถานะ**: ส่งมอบเสร็จสมบูรณ์ 100% (Passed 14/14 Tests, 0 Lint/Type Errors)

---

## 1. ขอบเขตการส่งมอบ (Scope Delivered)

Phase 1D มุ่งเน้นการจัดทำระบบประมวลผลข้อมูลอนุกรมเวลา (Time-Series Telemetry Processing) แบบครบวงจร (Vertical Slice 4) ตั้งแต่ตัวอุปกรณ์กลางสนาม จนถึงระบบฐานข้อมูล และหน้าจอแสดงผลของเกษตรกรและผู้ดูแลระบบ

### 1.1 Infrastructure & MQTT Broker
- **Eclipse Mosquitto 2.0 MQTT Broker**:
  - กำหนดค่าผ่าน `infrastructure/mosquitto/mosquitto.conf` รองรับพอร์ต `1883` (Standard MQTT) และ `8883` (MQTTS/TLS)
  - เพิ่มบริการ `mosquitto`, `mqtt-ingestor`, และ `simulator` ลงใน `docker-compose.yml`

### 1.2 Shared Telemetry Contracts (`packages/contracts/telemetry.py`)
- สัญญาโครงสร้างข้อมูล Payload มาตรฐาน Schema 2.0:
  - `WeatherPayloadV2`: อุณหภูมิอากาศ, ความชื้นสัมพัทธ์, ความเข้มแสง, ความเร็วลม, ทิศทางลม
  - `SoilPayloadV2`: อุณหภูมิดิน, ความชื้นดิน, EC, pH, และ NPK 7-in-1
  - `DeviceStatusPayload`: แบตเตอรี่ %, แรงดันไฟฟ้า, RSSI dBm, Uptime, สถานะ Online/Offline
  - `METRIC_RANGE_LIMITS`: ขอบเขตค่าชีววิทยาพืชสำหรับตรวจจับค่าหลุดมาตรฐาน (Out of Bounds)

### 1.3 Time-Series Database & Migrations (`backend/app/domains/telemetry/`)
- สร้างโมเดลฐานข้อมูล TimescaleDB Hypertables:
  - `sensor_readings`: บันทึกค่าอนุกรมเวลาจากเซนเซอร์ภาคสนาม (พร้อม Index `(farm_id, metric_key, observed_at)`)
  - `device_health_history`: บันทึกประวัติสุขภาพฮาร์ดแวร์ แบตเตอรี่ และสัญญาณไร้สาย
  - `raw_mqtt_messages`: บันทึก Raw Payload ดั้งเดิมเพื่อใช้ Audit และ Debugging
- **Alembic Migration**: `20260822_09_telemetry_hypertables.py` ดำเนินการสร้างตารางและดักจัดเก็บข้อมูลแล้ว

### 1.4 Ingestion Engine (`services/mqtt-ingestor/`)
- ระบบ Ingestor ประมวลผลข้อมูลสดจาก MQTT Broker:
  - รองรับการตรวจสอบข้อมูลซ้ำ (Deduplication ด้วย `message_id`)
  - **การชดเชยค่าสอบเทียบระดับฮาร์ดแวร์ (Hardware Calibration Formula $y = ax + b$)** โดยนำสูตรการสอบเทียบจาก `calibration_records` มาปรับแก้ค่าก่อนบันทึกลงฐานข้อมูล
  - ระบบย้ายข้อมูลที่ไม่ผ่านเกณฑ์เข้าสู่ Quarantine Queue เพื่อความปลอดภัยของชุดข้อมูล

### 1.5 Field Simulator Service (`services/simulator/`)
- บริการจำลองสัญญาณเซนเซอร์ภาคสนามสตรีมข้อมูลสดทุกๆ 10 วินาที:
  - จำลองสภาพอากาศตามวงรอบดวงอาทิตย์ (Diurnal Solar Cycle)
  - จำลองค่าดิน 7-in-1 สำหรับทุกแปลง (`Plot`) ในสวน (เช่น `ZoneA`, `ZoneB`)
  - ตรวจสอบและสร้างอุปกรณ์จำลองอัตโนมัติหากยังไม่มีเซนเซอร์ติดตั้ง

### 1.6 Backend Telemetry APIs (`backend/app/api/telemetry.py`)
- `GET /api/v1/farms/{farm_id}/telemetry/latest`: สรุปค่าตรวจวัดภาวะปัจจุบันของสวนและแปลง
- `GET /api/v1/farms/{farm_id}/telemetry/series`: ดึงข้อมูลอนุกรมเวลาเพื่อพลอตกราฟ (รองรับ `raw`, `5m`, `15m`, `1h`, `1d` intervals)
- `GET /api/v1/devices/{device_id}/health`: ดูประวัติสุขภาพฮาร์ดแวร์ ย้อนหลัง
- `GET /api/v1/admin/telemetry/overview`: รายงานสรุปภาพรวมและคิว Ingestion สำหรับผู้ดูแลระบบ

### 1.7 Frontend UI Dashboards & Chart UX (`frontend/components/farmer/telemetry-dashboard.tsx`)
- **หน้าจอ Farmer Telemetry (`/telemetry`)**:
  - รายงานสภาพอากาศสดและสุขภาพดิน 7-in-1 **แยกตามแปลงทุเรียนทุกแปลงในสวน**
  - **กราฟ Smooth Bézier Spline Curves**: เปลี่ยนจากเส้นหักมุมเดิมเป็นเส้นโค้งมนสมูท
  - **Area Gradient Shading**: การแลเงาไล่เฉดสีโปร่งแสงใต้เส้นกราฟสวยงาม
  - **Interactive Hover Tooltip**: กล่องแสดงผลลอย (Glassmorphism) ชี้บอกเวลา ค่าความละเอียด และสถานะสูตรสอบเทียบพร้อมวงแหวนเรืองแสงจุดโฟกัส
  - **Auto-Downsampling**: ระบบปรับความละเอียดอัตโนมัติ (15 นาทีสำหรับ 24 ชม., 1 ชั่วโมงสำหรับ 7 วัน, 1 วันสำหรับ 30 วัน) และ Dropdown ให้ผู้ใช้ปรับเปลี่ยนได้เอง
  - **Moving Average Filter**: กรองสัญญาณรบกวนขยะความถี่สูงให้อ่านแนวโน้มได้ง่ายขึ้น
- **หน้าจอ Admin Telemetry Monitor (`/admin/telemetry`)**:
  - ตรวจสอบสถานะ Ingestion Queue, Raw MQTT Stream, และคิว Quarantine ข้อมูล

---

## 2. การทดสอบและการตรวจสอบคุณภาพ (Verification & Testing)

- **Pytest Suite (`backend/tests/test_telemetry.py`)**:
  - ทดสอบการทำงาน 14 รายการผ่าน 100% (`14 passed`)
- **Frontend Code Quality**:
  - ESLint: `0 errors, 0 warnings`
  - TypeScript Typecheck: `0 errors, 0 warnings`
- **Data Persistence Verification**:
  - ทดสอบสตรีมข้อมูลจาก Simulator ผ่าน Mosquitto Broker และตรวจสอบการเขียนข้อมูลลงตาราง `sensor_readings` บน PostgreSQL สำเร็จ

---

## 3. เอกสารประกอบที่อัปเดต

1. [Roadmap โครงการ (`docs/ROADMAP.md`)](file:///d:/code_project/durian_portal/docs/ROADMAP.md) - ปรับสถานะ Phase 1D เป็น Complete
2. [ภาพรวม Phase 1 (`docs/phase-1/README.md`)](file:///d:/code_project/durian_portal/docs/phase-1/README.md) - เพิ่มบันทึกรายงาน 10-phase-1d-delivery.md
