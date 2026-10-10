# Phase 2A Delivery: Alert Rules Engine & Intelligent Notifications

**วันที่ส่งมอบ**: 10 ตุลาคม 2026  
**โครงการ**: DuriSense Portal  
**สถานะ**: ส่งมอบเสร็จสมบูรณ์ 100% (Passed Alembic Migrations, Pytest & Frontend Lint/Typecheck 0 Errors)

---

## 1. ขอบเขตการส่งมอบ (Scope Delivered)

Phase 2A มุ่งเน้นการพัฒนาระบบตรวจจับความผิดปกติของเซนเซอร์ภาคสนาม (Alert Rules Engine) และการแจ้งเตือนอัจฉริยะ (Intelligent Notifications) ตามข้อกำหนดใน `prompt.md` (หัวข้อ 4.6)

### 1.1 Database & Domain Models (`backend/app/domains/alerts/`)
- **SQLAlchemy Models**:
  - `AlertRule`: กฎการแจ้งเตือน (ความชื้นดิน, อุณหภูมิ, ความเค็ม EC, กรดด่าง pH, ออฟไลน์, รองรับ `duration_seconds` และ `hysteresis` กันค่าแกว่ง)
  - `AlertEvent`: บันทึกเหตุการณ์แจ้งเตือน พร้อมวงจรชีวิต `OPEN` ➔ `ACKNOWLEDGED` ➔ `RESOLVED` และบันทึกผู้รับทราบพร้อมหมายเหตุ
  - `NotificationPreference`: การตั้งค่ารับแจ้งเตือนรายบุคคล (In-App, Email, ระดับความรุนแรงขั้นต่ำ, และ Quiet Hours)
- **Alembic Migration**: `20260824_11_alerts_and_notifications.py` สร้าง ENUM (`alertseverity`, `alertstate`) และตารางลง PostgreSQL เรียบร้อยแล้ว (Head)

### 1.2 Backend API Routes (`backend/app/api/alerts.py`)
- `GET /api/v1/farms/{farm_id}/alerts/rules`: ดึงรายการกฎแจ้งเตือนของสวน
- `POST /api/v1/farms/{farm_id}/alerts/rules`: สร้างกฎแจ้งเตือนใหม่
- `PUT /api/v1/farms/{farm_id}/alerts/rules/{rule_id}`: อัปเดตกฎ / สลับสถานะเปิด-ปิด
- `DELETE /api/v1/farms/{farm_id}/alerts/rules/{rule_id}`: ลบกฎแจ้งเตือน
- `GET /api/v1/farms/{farm_id}/alerts/events`: ดึงประวัติเหตุการณ์แจ้งเตือน (กรองตามสถานะ OPEN, ACKNOWLEDGED, RESOLVED)
- `POST /api/v1/farms/{farm_id}/alerts/events/{event_id}/acknowledge`: กดรับทราบเหตุการณ์พร้อมบันทึกหมายเหตุหน้างาน
- `POST /api/v1/farms/{farm_id}/alerts/events/{event_id}/resolve`: กดปิดเหตุการณ์เป็นแก้ไขแล้ว
- `GET /api/v1/farms/{farm_id}/alerts/summary`: ดึงสรุปตัวเลข KPI (Open, Critical, Acknowledged, Active Rules)
- `GET /api/v1/notifications/inbox`: ดึงรายการแจ้งเตือนด่วนสำหรับ Notification Bell
- `GET /api/v1/notifications/preferences`: ดึงการตั้งค่าการแจ้งเตือนของผู้ใช้
- `PUT /api/v1/notifications/preferences`: อัปเดตการตั้งค่าการแจ้งเตือน

### 1.3 Rule Evaluation Engine (`backend/app/domains/alerts/service.py`)
- รองรับการประเมินค่าเซนเซอร์ตามเงื่อนไข: `LESS_THAN`, `GREATER_THAN`, `OUT_OF_RANGE`, `OFFLINE_TIMEOUT`
- มีระบบ **Hysteresis / Deadband**: ป้องกันการแจ้งเตือนติดๆ ดับๆ (Flapping) โดยต้องให้ค่าฟื้นตัวพ้นระยะ Deadband ก่อนจะ Auto-Resolve เหตุการณ์

### 1.4 Frontend UI Components & Farmer Shell Integration
- **Alerts Operations Manager (`/alerts`)**:
  - การ์ดสรุป KPI ด้านบน (🚨 เหตุการณ์เปิดอยู่, ⚠️ วิกฤต, 👀 รับทราบแล้ว, 📻 กฎที่ทำงานอยู่)
  - แท็บ 1: **บันทึกเหตุการณ์แจ้งเตือน**: ฟิลเตอร์ตามสถานะ, ปุ่มกดรับทราบ (Acknowledge Modal), ปุ่มกดแก้ไขแล้ว (Resolve Modal)
  - แท็บ 2: **จัดการกฎการแจ้งเตือน**: ดูรายการกฎ, สวิตช์เปิด-ปิด, ปุ่มและ Modal สร้างกฎใหม่, ปุ่มลบกฎ
  - แท็บ 3: **ตั้งค่าช่องทางแจ้งเตือน**: เปิด-ปิด In-App / Email, กำหนดระดับความรุนแรงขั้นต่ำ, กำหนดช่วงเวลาห้ามรบกวน (Quiet Hours)
- **Header Notification Bell (`farmer-shell.tsx`)**:
  - ไอคอนกระดิ่ง 🔔 พร้อม Badge ตัวเลขสีแดงบอกจำนวนเหตุการณ์ `OPEN`
  - Dropdown Drawer เปิดดูแจ้งเตือน 5 รายการล่าสุดได้ทันทีจากทุกหน้าจอ
  - เมนูนำทางด้านข้างเพิ่ม **"การแจ้งเตือน (/alerts)"**

---

## 2. การทดสอบและการตรวจสอบคุณภาพ (Verification & Testing)

1. **Alembic Migration**: `docker compose exec -T api alembic upgrade head` ผ่านสมบูรณ์ (`20260824_11` applied)
2. **Backend Unit Tests (`backend/tests/test_alerts.py`)**: ผ่าน 100% (ทดสอบ Schema, Enum, Threshold, Hysteresis, Auto-Resolve)
3. **Frontend ESLint & Typecheck**:
   - `npm run lint`: `0 errors, 0 warnings`
   - `npm run typecheck`: `0 errors, 0 warnings`
