# Phase 1E Delivery: Relay Control & Operational Activity Tracking

**วันที่ส่งมอบ**: 23 สิงหาคม 2026  
**โครงการ**: DuriSense Portal  
**สถานะ**: ส่งมอบเสร็จสมบูรณ์ 100% (Passed Alembic Migrations, Pytest & Frontend Lint/Typecheck 0 Errors)

---

## 1. ขอบเขตการส่งมอบ (Scope Delivered)

Phase 1E มุ่งเน้นการจัดทำระบบสั่งการอุปกรณ์แอคชูเอเตอร์เปิด-ปิดภาคสนาม (Relay Control System) ผ่านโปรโตคอล MQTT และระบบบันทึกประวัติการดูแลสวนทุเรียน (Farm Activity Logs)

### 1.1 Database & Domain Models (`backend/app/domains/operations/`)
- **Relay Models**:
  - `RelayChannel`: เก็บข้อมูลแชนเนลรีเลย์ 1-4 (ชื่อแสดงผล, GPIO pin, สถานะ desired/reported, ประวัติคำสั่งยืนยัน ACK)
  - `RelayCommand`: บันทึกคำสั่งเปิด/ปิด (target_state, pulse duration, state: `PENDING`/`ACKNOWLEDGED`/`FAILED`)
  - `RelayCommandEvent`: บันทึกประวัติ event trail การส่งคำสั่งและการยืนยัน ACK
- **Activity Log Models**:
  - `FarmActivity`: บันทึกประวัติการดูแลสวน (`IRRIGATION`, `FERTILIZATION`, `PESTICIDE`, `PRUNING`, `HARVEST`, `OTHER`)
- **Alembic Migration**: `20260823_10_operations_and_relays.py` สร้างตารางและสร้างประเภท ENUM บน PostgreSQL เรียบร้อยแล้ว

### 1.2 Backend API Routes (`backend/app/api/operations.py`)
- `GET /api/v1/farms/{farm_id}/relays`: รายงานแชนเนลรีเลย์และสถานะปัจจุบันของสวน
- `POST /api/v1/farms/{farm_id}/relays/{channel_id}/command`: ส่งคำสั่งสั่งเปิด-ปิดรีเลย์ พร้อมกำหนดเวลาปิดอัตโนมัติ (Pulse Timer 5m, 15m, 30m, 1h)
- `GET /api/v1/farms/{farm_id}/activities`: ดึงประวัติการดูแลสวน
- `POST /api/v1/farms/{farm_id}/activities`: เพิ่มบันทึกกิจกรรมใหม่
- `DELETE /api/v1/farms/{farm_id}/activities/{activity_id}`: ลบบันทึกกิจกรรม

### 1.3 Frontend UI Dashboards & Navigation
- **Relay Control Center (`/relays`)**:
  - หน้าจอศูนย์ควบคุมรีเลย์ปั๊มน้ำ วาล์วสปริงเกลอร์ และปั๊มปุ๋ย Real-Time
  - ปุ่มสวิตช์กำลังขนาดใหญ่ (Power Switch Button) พร้อมไฟ LED สัญลักษณ์สถานะ 🟢 ON / ⚪ OFF / 🟡 PENDING
  - แถบเลือกเวลา Pulse Timer 5 นาที, 15 นาที, 30 นาที, 1 ชั่วโมง หรือเปิดค้างไว้
  - **Floating Toast Notification System**: ปรับเปลี่ยนการแจ้งเตือนส่งคำสั่งรีเลย์เป็นกล่อง Toast ลอยมุมขวาล่าง พร้อมระบบซ่อนอัตโนมัติ 4 วินาที ไม่บดบังปุ่มควบคุม
  - **Auto Shut-Off Sync**: ระบบคำนวณและอัปเดตสถานะปิดอัตโนมัติเมื่อครบกำหนดเวลา Pulse Timer ทั้งฝั่ง Server และ Hardware
- **Farm Activity Journal (`/activities`)**:
  - ฟอร์มบันทึกกิจกรรมประจำวัน (การให้น้ำ, ใส่ปุ๋ย, ฉีดพ่นสารเคมี, ตัดแต่งกิ่ง, เก็บเกี่ยวผลผลิต)
  - Timeline Cards แสดงรายการย้อนหลังพร้อม Badge จำแนกประเภทกิจกรรม ปริมาณน้ำ น้ำหนักปุ๋ย และผลผลิตที่เก็บเกี่ยวได้
  - **Non-overlapping Modal Form**: แยกช่องเลือก **วันที่** (`date`) และ **เวลา** (`time`) ออกเป็น 2 ช่องคู่กัน พร้อมตั้งค่า `max-height: 90vh` และ `overflow-y: auto` ป้องกันการบดบังปุ่มกดบันทึก
- **HTTP 204 No Content Handling (`lib/api.ts`)**:
  - ปรับปรุงตัวจัดการ `apiFetch` ให้รองรับคำสั่ง DELETE / HTTP 204 No Content อย่างสมบูรณ์ ไม่หลุดขัดข้องจาก `response.json()`
- **Farmer Navigation Shell (`farmer-shell.tsx`)**:
  - เพิ่มเมนู `ควบคุมรีเลย์ (/relays)` และ `บันทึกกิจกรรม (/activities)` ในแถบเมนูหลัก

---

## 2. การทดสอบและการตรวจสอบคุณภาพ (Verification & Testing)

- **Alembic Migration**: `docker compose exec -T api alembic upgrade head` ผ่านสมบูรณ์ (20260823_10 applied)
- **Pytest Suite (`backend/tests/test_operations.py`)**: ผ่าน 100%
- **Frontend Code Quality**:
  - ESLint: `0 errors, 0 warnings`
  - TypeScript Typecheck: `0 errors, 0 warnings`

---

## 3. เอกสารประกอบที่อัปเดต

1. [Roadmap โครงการ (`docs/ROADMAP.md`)](file:///d:/code_project/durian_portal/docs/ROADMAP.md) - ปรับสถานะ Phase 1E เป็น Complete
2. [ภาพรวม Phase 1 (`docs/phase-1/README.md`)](file:///d:/code_project/durian_portal/docs/phase-1/README.md) - เพิ่มบันทึกรายงาน 11-phase-1e-delivery.md
