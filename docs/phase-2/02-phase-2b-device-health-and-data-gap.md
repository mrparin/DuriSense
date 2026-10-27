# Phase 2B Delivery: Device Health & Data Gap Analytics

**วันที่ส่งมอบ**: 28 ตุลาคม 2026  
**โครงการ**: DuriSense Portal  
**สถานะ**: ส่งมอบเสร็จสมบูรณ์ 100% (Passed Pytest & Frontend Lint/Typecheck 0 Errors)

---

## 1. ขอบเขตการส่งมอบ (Delivered Scope)

Phase 2B มุ่งเน้นการยกระดับการบริหารจัดการอุปกรณ์ภาคสนาม การตรวจสอบความเสถียรของสัญญาณ และการวิเคราะห์ช่องว่างของข้อมูลเซนเซอร์ (Data Gap Detection) ตามข้อกำหนดใน `prompt.md` และ `structure.md`

### 1.1 Backend Domain Models & Schemas (`backend/app/domains/telemetry/schemas.py`)
- **Device Health Schemas**:
  - `DeviceHealthHistoryItem`: บันทึกข้อมูลสุขภาพรายประวัติ (วันเวลา, battery %, voltage, RSSI, status, uptime)
  - `DeviceHealthDetailResponse`: ข้อมูลสุขภาพเชิงลึกรายอุปกรณ์ (สถานะ, แบตเตอรี่, ระดับคุณภาพสัญญาณ, uptime formatted, ประวัติย้อนหลัง 50 ครั้ง)
  - `StationHealthSummary` & `SensorHealthSummary`: ข้อมูลสถานะอุปกรณ์พร้อมจำนวนเซนเซอร์ลูกข่าย
  - `FarmHealthSummaryResponse`: ภาพรวมอุปกรณ์ทั้งสวน (Online, Degraded, Offline, Low Battery, Weak RSSI)
- **Data Gap Analytics Schemas**:
  - `DataGapItem`: รายการช่องว่างข้อมูลที่ขาดหายไป (สถานี, แปลง, เวลาเริ่มต้น-สิ้นสุด, ระยะเวลา, ความรุนแรง MINOR/MODERATE/CRITICAL, สาเหตุที่คาดการณ์)
  - `StationGapSummary`: สรุป Gap และ Data Completeness Rate (%) รายสถานี
  - `DataGapReportResponse`: รายงานความสมบูรณ์ของข้อมูลรวมทั้งสวน พร้อมตัวกรอง Threshold
  - `OfflineCheckResult`: ผลลัพธ์การตรวจจับอุปกรณ์ออฟไลน์และการ Trigger แจ้งเตือน

### 1.2 Backend Service & Algorithms (`backend/app/domains/telemetry/service.py`)
- **Offline & Degraded Detection Algorithm**:
  - `determine_device_health_status`:
    - `ONLINE`: รับข้อมูลสม่ำเสมอภายใน 15 นาที
    - `DEGRADED`: แบตเตอรี่ต่ำกว่า 20%, สัญญาณ RSSI &lt; -85 dBm, หรือเริ่มรายงานล่าช้า (15-60 นาที)
    - `OFFLINE`: ขาดการติดต่อนานเกิน Timeout (ค่าเริ่มต้น 60 นาที)
  - `get_battery_status` & `get_signal_quality`: ประเมินระดับแบตเตอรี่ (GOOD, FAIR, LOW, CRITICAL) และสัญญาณ (EXCELLENT, GOOD, FAIR, POOR)
- **Data Gap Analyzer**:
  - วิเคราะห์ระยะห่างระหว่างจุดตรวจวัด $t_{i+1} - t_i$ เทียบกับ `threshold_seconds`
  - ตรวจสอบ Edge Gaps (ช่วงต้นจาก start_date และช่วงท้ายถึงปัจจุบัน)
  - คำนวณ **Data Completeness Rate (%)** ตามช่วงเวลาที่เลือก
- **Alert Rules Engine Integration (`check_farm_offline_devices`)**:
  - สแกนอุปกรณ์ออฟไลน์ และสร้างเหตุการณ์แจ้งเตือน `OFFLINE_TIMEOUT` ไปยัง Notification Bell และหน้า `/alerts`
  - Auto-Resolve เหตุการณ์เมื่อสถานีกลับมาส่งสัญญาณออนไลน์ตามปกติ

### 1.3 REST API Endpoints (`backend/app/api/telemetry.py`)
- `GET /api/v1/farms/{farm_id}/health/summary`: สรุปภาพรวมสุขภาพอุปกรณ์ทั้งสวน
- `GET /api/v1/devices/{device_id}/health/detail`: ดูรายละเอียดสุขภาพอุปกรณ์เชิงลึก
- `GET /api/v1/farms/{farm_id}/health/data-gaps`: รายงาน Data Gap และ Data Completeness % (รองรับตัวกรอง 24h, 7d, 30d และรายสถานี)
- `POST /api/v1/farms/{farm_id}/health/check-offline`: สั่งตรวจจับสถานะออฟไลน์และประเมิน Alert Rules ทันที

### 1.4 Frontend User Interface (`frontend/components/farmer/`)
- **`DeviceHealthCenter` (`device-health-center.tsx`)**:
  - แท็บ 1: **สุขภาพอุปกรณ์และระดับสัญญาณ**: KPI Cards 4 ช่อง (Online, Degraded, Offline, Sensors), การ์ดสถานีพร้อมเกจวัดแบตเตอรี่และคุณภาพสัญญาณ RSSI, ตารางเซนเซอร์ดิน, ปุ่มกดตรวจสอบสถานะออฟไลน์ทันที
  - แท็บ 2: **รายงานข้อมูลขาดช่วง (Data Gap Report)**: ตัวกรองช่วงเวลา (24 ชม., 7 วัน, 30 วัน), ตัวกรอง Threshold (15, 30, 60 นาที), ความสมบูรณ์ของข้อมูลรวม (Data Completeness %), แถบสถานะรายสถานี, ตารางแจกแจง Gap พร้อมปุ่ม **ส่งออกรายงาน CSV**
  - **Deep-Dive Diagnostic Modal**: หน้าต่างป๊อปอัปแสดงประวัติสุขภาพย้อนหลัง 10 ครั้งล่าสุด พร้อมระดับแรงดันและ uptime
- **`DevicesWorkspace` (`devices-workspace.tsx`)**:
  - ควบคุมการสลับหน้าระหว่าง "สุขภาพอุปกรณ์ & สัญญาณขาดช่วง" และ "ทะเบียนอุปกรณ์" อย่างไร้รอยต่อในหน้า `/devices`

---

## 2. การตรวจสอบและทดสอบคุณภาพ (Verification & Testing)

1. **Automated Unit Tests (`backend/tests/test_telemetry.py`)**:
   - `test_battery_status_evaluation`: ผ่าน 100%
   - `test_signal_quality_evaluation`: ผ่าน 100%
   - `test_duration_th_formatting`: ผ่าน 100%
   - `test_device_health_status_determination`: ผ่าน 100% (ทดสอบ ONLINE, DEGRADED, OFFLINE)
   - `test_phase_2b_schemas`: ผ่าน 100%
2. **Frontend Typecheck & Linting**:
   - `npm --prefix frontend run typecheck`: **0 errors**
   - `npm --prefix frontend run lint`: **0 errors, 0 warnings**
