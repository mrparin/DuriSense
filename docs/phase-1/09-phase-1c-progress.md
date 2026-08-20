# Phase 1C Progress: Farm and Device Registry

ตรวจสถานะล่าสุด: 20 สิงหาคม 2026

เอกสารนี้เป็นบันทึกต่อเนื่องของ Phase 1C เพื่อให้กลับมาพัฒนาต่อได้โดยไม่ต้องอาศัยความจำจากบทสนทนา
สถานะสรุประดับโครงการยังคงยึด [Canonical Roadmap](../ROADMAP.md) เป็นหลัก

## ส่งมอบแล้ว

### Backend และฐานข้อมูล

- เพิ่ม domain `registry` แยกจาก Identity
- เพิ่ม `farms`, `farm_memberships`, `plots`, `devices`, `weather_stations`, `soil_sensors`,
  `sensor_assignments`, `device_credentials` และ `decommission_records`
- เพิ่ม Alembic revision `20260820_06` สำหรับ schema และ `20260820_07` สำหรับ backfill สวนของบัญชีเดิม
- การสมัครสมาชิกใหม่สร้าง Farm และ owner membership พร้อม Tenant เดิมโดยอัตโนมัติ
- Farm/Plot create, list, read, update และ archive ภายใต้ membership scope
- Weather Station และ Soil Sensor create, list, read และ update
- Soil Sensor รองรับ `SOIL_TH`, `SOIL_7_IN_1` และ Modbus address 1-247
- Assignment ใหม่ปิดช่วง assignment ปัจจุบันก่อนสร้างประวัติรายการใหม่ และป้องกันช่วงเวลาเริ่มต้นย้อนทับ
- Weather Station credential rotation revoke credential เดิม แสดง secret ใหม่ครั้งเดียว และจัดเก็บเฉพาะ keyed hash
- Decommission เป็น soft lifecycle: เปลี่ยนสถานะอุปกรณ์, revoke credential, ปิด assignment และเพิ่ม audit/decommission record
- Resource ข้าม farm/tenant คืน 404 เพื่อลด IDOR/resource enumeration
- Mutation ทุก endpoint ใช้ session, CSRF และ Origin validation เดิมจาก Phase 1B

### Frontend

- เพิ่ม Farmer workspace ที่มี navigation แยกจาก Admin
- เพิ่ม `/farms` สำหรับเลือกสวน ดูแปลง เพิ่มสวน และเพิ่มแปลง
- เพิ่ม `/devices` สำหรับลงทะเบียน Weather Station/Soil Sensor, กำหนด assignment,
  ออก credential และเริ่ม decommission flow พร้อมคำเตือนผลกระทบ
- เปลี่ยน Farmer login destination จาก `/profile` เป็น `/farms`
- ใช้ข้อมูล API จริง ไม่มี farm/device metrics จำลอง
- รองรับ loading, empty, error, success, disabled และ destructive confirmation states
- ตรวจ viewport 1280x800 และ 360x800; mobile ไม่มี horizontal overflow และ control ที่ตรวจมีความสูงอย่างน้อย 44px

## การตรวจสอบล่าสุด

- `npm.cmd run lint` — ผ่าน
- `npm.cmd run typecheck` — ผ่าน
- `npm.cmd run build` — ผ่าน รวม route `/farms` และ `/devices` ทั้งหมด 16 routes
- Backend regression suite — ผ่าน 9 tests
- Registry tests — ผ่าน 3 tests ครอบคลุม lifecycle, CSRF และ cross-tenant isolation
- PostgreSQL migration — `20260820_07 (head)` และพบตารางใหม่ครบ 9 ตาราง
- API health — `{"status":"ok"}`
- Browser flow — login, create plot, create station, create sensor, assignment และ one-time credential ทำงานจริง
- แก้ browser finding ที่ form แสดง success และ error พร้อมกันหลัง submit โดยเก็บ form reference ก่อน `await`

ข้อมูลบัญชี/สวน/อุปกรณ์ QA ที่สร้างเพื่อ browser test ถูกลบออกจาก PostgreSQL หลังตรวจเสร็จแล้ว

## งานถัดไป

1. เพิ่ม farm membership invite, list, role change และ revoke พร้อม permission matrix
2. เพิ่ม calibration record และ metadata ที่อ้างอิง sensor/ผู้ปฏิบัติงาน/เวลา
3. เพิ่ม UI edit/archive สำหรับ Farm, Plot และ Device ให้ครบกับ API
4. เพิ่ม reassignment history view และ credential status โดยไม่เปิดเผย secret เดิม
5. เพิ่ม browser regression สำหรับ error, validation และ destructive confirmation รอบสมบูรณ์

## ข้อควรระวัง

- ห้ามรับ `tenant_id` จาก client แล้วเชื่อถือโดยไม่ตรวจ Tenant/Farm membership
- ห้ามแสดง credential เดิมซ้ำหรือบันทึก plaintext ลงฐานข้อมูล/log
- ห้าม hard-delete device/assignment history ที่ใช้เป็น provenance
- เมื่อเริ่ม Phase 1D ต้อง resolve telemetry ตาม assignment ที่ครอบคลุม `observed_at` ไม่ใช่ assignment ปัจจุบันอย่างเดียว
