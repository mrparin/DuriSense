# คู่มือการเปิดระบบและทดสอบการทำงาน DuriSense Portal
(DuriSense System Quick Start & Testing Guide)

เอกสารนี้รวบรวมคำสั่งและขั้นตอนทั้งหมดในการเริ่มต้นใช้งานระบบ DuriSense ทั้งฝั่ง **Backend (Docker Compose)** และ **Frontend (Next.js)** สำหรับการทดสอบในเครื่อง Local Environment

---

## 1. ข้อกำหนดเบื้องต้น (Prerequisites)

ก่อนเริ่มต้น ให้ตรวจสอบว่าติดตั้งและเปิดใช้งานโปรแกรมต่อไปนี้เรียบร้อยแล้ว:
* **Docker Desktop บน Windows**: ต้องเปิดใช้งาน (Running) เพื่อรันฐานข้อมูล, MQTT Broker, API, Ingestor, และ Simulator
* **Node.js** (เวอร์ชัน $\ge$ 20.9.0) และ **npm**: สำหรับรัน Frontend Dev Server

---

## 2. ขั้นตอนการเปิดใช้งาน Backend Services

เปิดหน้าต่าง **Terminal / PowerShell (หน้าต่างที่ 1)** ที่โฟลเดอร์โปรเจกต์ `d:\code_project\durian_portal`:

### 2.1 สั่ง Build และ Start คอนเทนเนอร์ทั้งหมด
```powershell
docker compose up -d --build
```

### 2.2 อัปเดตตารางฐานข้อมูลล่าสุด (Database Migrations)
```powershell
docker compose exec api alembic upgrade head
```

### 2.3 ตรวจสอบสถานะการทำงานและ Logs
* **ดูสถานะ Container ทั้งหมด:**
  ```powershell
  docker compose ps
  ```
* **ดู Logs ของ API (FastAPI):**
  ```powershell
  docker compose logs -f api
  ```
* **ดู Logs ของ Field Simulator (สตรีมข้อมูลเซนเซอร์จำลองทุก 10 วินาที):**
  ```powershell
  docker compose logs -f simulator
  ```
* **ดู Logs ของ MQTT Ingestor:**
  ```powershell
  docker compose logs -f mqtt-ingestor
  ```

---

## 3. พอร์ตและบริการ Backend ในระบบ

| บริการ (Service) | พอร์ต (Local Port) | รายละเอียด / ลิงก์เข้าใช้งาน |
|---|---|---|
| **FastAPI Backend API** | `8000` | [http://127.0.0.1:8000](http://127.0.0.1:8000) (Interactive Swagger Docs: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)) |
| **Mailpit (Webmail จำลอง)** | `8025` | [http://127.0.0.1:8025](http://127.0.0.1:8025) (ดูอีเมลยืนยันตัวตน, Reset Password, แจ้งเตือน) |
| **Mosquitto MQTT Broker** | `1883`, `8883` | รับ-ส่งข้อความ Telemetry และ Relay Commands |
| **PostgreSQL / TimescaleDB**| `5432` | ฐานข้อมูลหลักและ Hypertables ข้อมูลเซนเซอร์ |
| **Field Simulator** | Background | ส่งข้อมูลสภาพอากาศและดิน 7-in-1 อัตโนมัติทุก 10 วินาที |

---

## 4. ขั้นตอนการเปิดใช้งาน Frontend (Next.js)

เปิดหน้าต่าง **Terminal / PowerShell (หน้าต่างที่ 2)** ที่โฟลเดอร์โปรเจกต์ `d:\code_project\durian_portal`:

```powershell
npm run dev
```
*(หรือสั่งผ่านโฟลเดอร์ frontend: `npm --prefix frontend run dev`)*

เมื่อรันสำเร็จ สามารถเปิดเบราว์เซอร์เข้าใช้งานได้ที่:
🌐 **[http://127.0.0.1:4173](http://127.0.0.1:4173)** หรือ **[http://localhost:4173](http://localhost:4173)**

---

## 5. เส้นทางหน้าจอหลักสำหรับการทดสอบ (Test Scenarios)

### 5.1 สุขภาพอุปกรณ์และรายงานสัญญาณขาดช่วง (Phase 2B) 🩺
* **URL**: [http://127.0.0.1:4173/devices](http://127.0.0.1:4173/devices)
* **สิ่งที่จะได้ทดสอบ**:
  * **แท็บสุขภาพอุปกรณ์**: ตรวจสอบสถานะการเชื่อมต่อ (ออนไลน์ / เสื่อมถอย / ออฟไลน์), เกจวัดระดับแบตเตอรี่ (%) และแรงดัน (V), คุณภาพสัญญาณ RSSI (dBm)
  * **ปุ่มตรวจสถานะออฟไลน์ทันที**: กดปุ่มเพื่อประเมินสถานะอุปกรณ์แบบ Dynamic และสร้างแจ้งเตือน `OFFLINE_TIMEOUT`
  * **ปุ่มดูประวัติสุขภาพ**: หน้าต่างป๊อปอัปแสดงประวัติการส่งสัญญาณ 10 ครั้งล่าสุด พร้อม Uptime
  * **แท็บรายงานข้อมูลขาดช่วง (Data Gap Report)**: กรองดูช่วงเวลา 24 ชม., 7 วัน, 30 วัน, ค่าความสมบูรณ์ของข้อมูล (Completeness Rate %), ตารางแจกแจง Gap พร้อม **ปุ่มส่งออก CSV**

### 5.2 ข้อมูลตรวจวัดสภาพอากาศและดินเรียลไทม์ (Phase 1D) 🌦️
* **URL**: [http://127.0.0.1:4173/telemetry](http://127.0.0.1:4173/telemetry)
* **สิ่งที่จะได้ทดสอบ**: กราฟเส้นความชันแบบ Bézier Spline Curves, ความชื้นดิน, pH, NPK, สภาพอากาศจากสถานีจริงและ Simulator

### 5.3 ศูนย์แจ้งเตือนและการตั้งค่าเงื่อนไข (Phase 2A) 🔔
* **URL**: [http://127.0.0.1:4173/alerts](http://127.0.0.1:4173/alerts)
* **สิ่งที่จะได้ทดสอบ**: กระดิ่งแจ้งเตือนบน Header (Notification Bell), บันทึกเหตุการณ์ (Open / Acknowledged / Resolved), การสร้างกฎแจ้งเตือนใหม่

### 5.4 ควบคุมรีเลย์ปั๊มน้ำและวาล์ว (Phase 1E) ⚡
* **URL**: [http://127.0.0.1:4173/relays](http://127.0.0.1:4173/relays)
* **สิ่งที่จะได้ทดสอบ**: สวิตช์เปิด/ปิด 4 ช่องประจำแปลง, ตัวจับเวลาตัดไฟอัตโนมัติ (Pulse Timers: 5 นาที, 15 นาที, 30 นาที)

### 5.5 บันทึกกิจกรรมสวน (Phase 1E) 📖
* **URL**: [http://127.0.0.1:4173/activities](http://127.0.0.1:4173/activities)
* **สิ่งที่จะได้ทดสอบ**: บันทึกการให้น้ำ ใส่ปุ๋ย ฉีดพ่นยา ตัดแต่งกิ่ง และเก็บเกี่ยวผลผลิต

---

## 6. คำสั่งรัน Automated Tests และตรวจสอบคุณภาพโค้ด

### 6.1 รัน Backend Tests (Pytest)
```powershell
npm run test:backend
```
*(หรือสั่งรันผ่าน Docker โดยตรง: `docker compose --profile test run --rm --build api-test`)*

### 6.2 ตรวจสอบ Typecheck ของ Frontend (TypeScript)
```powershell
npm run typecheck
```

### 6.3 ตรวจสอบ ESLint Code Quality ของ Frontend
```powershell
npm run lint
```

---

## 7. คำสั่งหยุดการทำงานของระบบ (Shutdown)

เมื่อต้องการปิดระบบ Backend ให้รันคำสั่ง:
```powershell
docker compose down
```
*(หากต้องการลบข้อมูลใน Volume ทั้งหมดเพื่อเริ่มต้นใหม่ตั้งแต่ต้น ให้ใช้ `docker compose down -v`)*
