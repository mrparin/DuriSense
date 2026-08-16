# Prompt สำหรับสั่ง AI พัฒนา Web Portal สวนทุเรียนอัจฉริยะ

## บทบาทของ AI

คุณคือทีมสถาปนิกซอฟต์แวร์และนักพัฒนา Full-stack ที่เชี่ยวชาญ Next.js, FastAPI, Eclipse Mosquitto, MQTT/TLS, PostgreSQL + TimescaleDB, University Firewall/WAF/Reverse Proxy, Docker Security, IoT Security และระบบเกษตรอัจฉริยะ จงออกแบบและพัฒนา **Web Portal สำหรับเกษตรกรสวนทุเรียน** ที่ใช้งานง่าย รองรับภาษาไทย และพร้อมต่อยอดจากต้นแบบไปสู่ระบบใช้งานจริงสำหรับงานบริการวิชาการของมหาวิทยาลัย

ห้ามเริ่มเขียนโค้ดทั้งหมดทันที ให้เริ่มจากการวิเคราะห์ requirement, ระบุสมมติฐาน, เสนอ architecture, data model, API contract, MQTT topic/payload และแผนการพัฒนาเป็นระยะ แล้วจึงสร้างระบบทีละส่วนพร้อมการทดสอบ

## 1. เป้าหมายของระบบ

สร้างระบบที่รับข้อมูลเซนเซอร์จากหลายสวนผ่าน MQTT จัดเก็บข้อมูลอย่างเหมาะสม แสดง Dashboard แยกตามบัญชีผู้ใช้ และส่งคำสั่งควบคุมรีเลย์ 4 ช่องบนบอร์ดหลักกลับไปยังอุปกรณ์อย่างปลอดภัย โดยเกษตรกรเห็นและควบคุมเฉพาะอุปกรณ์ในสวนของตน ส่วนผู้ดูแลระบบสามารถบริหารผู้ใช้ สวน อุปกรณ์ และตรวจสอบสุขภาพของระบบได้ โครงสร้างอุปกรณ์ต้องรองรับหนึ่งแปลงมี Weather Station หนึ่งสถานีหรือมากกว่า และแต่ละ Weather Station เชื่อม Soil Sensor แยกเพิ่มได้หลายตัว

ระบบต้องรองรับงานบริหารจัดการน้ำในสวนทุเรียนและงานวิจัยในอนาคต เช่น การวิเคราะห์อุณหภูมิ ความชื้นสัมพัทธ์ ความชื้นดิน ปริมาณฝน แสง ลม VPD และสถานะระบบให้น้ำ แต่ต้องออกแบบให้เพิ่มชนิดเซนเซอร์ใหม่ได้โดยไม่แก้โครงสร้างหลักมาก

## 2. เทคโนโลยีหลัก

- Frontend: Next.js รุ่นเสถียรล่าสุดแบบ App Router, TypeScript และ responsive UI
- Backend: FastAPI, Python, REST API และ WebSocket หรือ Server-Sent Events สำหรับข้อมูลใกล้เวลาจริง
- MQTT Broker ที่เลือกแล้ว: Eclipse Mosquitto 2.x โดย pin image version ที่ทดสอบแล้ว รองรับ MQTT 3.1.1/5.0, TLS, per-device username/password หรือ client certificate, topic ACL, LWT และ persistence
- Database ที่เลือกแล้ว: PostgreSQL + TimescaleDB ในฐานข้อมูลเดียว โดยใช้ตาราง PostgreSQL ปกติสำหรับผู้ใช้ สิทธิ์ สวน อุปกรณ์ รีเลย์ และธุรกรรม และใช้ TimescaleDB hypertable สำหรับ telemetry, device health และ raw MQTT messages
- ห้ามใช้ InfluxDB หรือ Supabase ในสถาปัตยกรรมนี้ เว้นแต่เจ้าของโครงการสั่งเปลี่ยนในภายหลัง
- Cache/queue (เมื่อจำเป็น): Redis และ background worker สำหรับงานแจ้งเตือน การประมวลผล และงานที่ใช้เวลานาน
- Reverse Proxy: Nginx เป็น application reverse proxy รับ traffic เฉพาะจาก University Reverse Proxy/เครือข่ายต้นทางที่ได้รับอนุญาต แล้ว route ไป Next.js และ FastAPI ผ่าน Docker internal network
- Web ingress: ใช้ University Firewall/WAF/Reverse Proxy เป็นด่านภายนอก ไม่ใช้ Cloudflare Tunnel เปิด `443/TCP` เฉพาะตามกระบวนการอนุมัติของมหาวิทยาลัย และบันทึก domain, origin port, source restriction, TLS termination และผู้รับผิดชอบ log ไว้ใน deployment document
- Deployment: Docker Compose แยก `edge_net`, `app_net`, `iot_net` และ `data_net` พร้อม secrets, health checks, resource limits และ automated off-site backup

ห้ามกำหนด dependency แบบลอยตัว ให้ระบุเวอร์ชันที่เข้ากันได้ในไฟล์ dependency และสร้าง `.env.example` โดยไม่มี secret จริง

## 3. ผู้ใช้งานและสิทธิ์

### 3.0 ผู้เยี่ยมชม (Visitor)

- เข้าถึง Landing page สาธารณะเพื่ออ่านภาพรวมโครงการ ประโยชน์ของระบบ คุณสมบัติหลัก และช่องทางติดต่อ
- ใช้เมนู `เข้าสู่ระบบ` และ `สมัครสมาชิก` ได้โดยไม่ต้องมีบัญชี
- ไม่มีสิทธิ์เข้าถึงข้อมูลสวน รายชื่อผู้ใช้ อุปกรณ์ หรือ telemetry ใด ๆ

### 3.1 Admin

- เข้าสู่ระบบและออกจากระบบอย่างปลอดภัย
- สร้าง แก้ไข ระงับ และรีเซ็ตรหัสผ่านผู้ใช้
- ตรวจรายชื่อผู้สมัครใหม่ ดูสถานะการยืนยันอีเมล อนุมัติ ปฏิเสธ หรือระงับบัญชี พร้อมบันทึกเหตุผล
- ส่งลิงก์ยืนยันอีเมลใหม่ได้ และอนุมัติบัญชีเป็นรายคนได้โดยตรง แม้ผู้สมัครยังไม่ได้กดลิงก์ยืนยันอีเมล การอนุมัติของ Admin ถือเป็นช่องทางยืนยันและเปิดใช้งานบัญชีที่ถูกต้องอีกช่องทางหนึ่ง
- กำหนด role และสิทธิ์ โดยเริ่มต้นอย่างน้อย `ADMIN` และ `FARMER` และออกแบบให้เพิ่ม `RESEARCHER` หรือ `TECHNICIAN` ได้
- สร้างและจัดการสวน แปลง ตำแหน่งติดตั้ง sensor node และการผูกเจ้าของสวน
- ลงทะเบียน/ยกเลิกอุปกรณ์ ออก credential ใหม่ และตรวจสอบสถานะ online/offline, last seen, firmware version และแบตเตอรี่
- ดูภาพรวมระบบ เช่น จำนวนผู้ใช้ สวน อุปกรณ์ offline ข้อมูลขาดช่วง และแจ้งเตือนที่ยังไม่รับทราบ
- ดู audit log ของการเข้าสู่ระบบ การแก้ไขข้อมูล การเปลี่ยนสิทธิ์ และคำสั่งควบคุมอุปกรณ์
- ห้าม Admin เห็นรหัสผ่านหรือ secret แบบ plain text

### 3.2 Farmer

- เห็นและแก้ไขโปรไฟล์ของตนเอง
- เห็นเฉพาะสวน แปลง อุปกรณ์ ข้อมูลเซนเซอร์ และแจ้งเตือนที่ได้รับสิทธิ์เท่านั้น
- เพิ่ม แก้ไข และยกเลิกการใช้งาน Weather Station/Soil Sensor ของสวนตนเองผ่าน Dashboard ได้ เช่น ชื่ออุปกรณ์ โซน ตำแหน่ง ชนิด `SOIL_TH`/`SOIL_7_IN_1`, sampling interval และรายละเอียดติดตั้ง รวมถึง assign/reassign Soil Sensor ไปยัง Weather Station โดยเก็บประวัติการย้าย
- ตั้งชื่อใช้งานของรีเลย์ทั้ง 4 ช่องในแต่ละบอร์ดได้ เช่น `ปั๊มน้ำโซน A`, `วาล์วแปลง 2` หรือ `ไฟส่องสว่าง` โดยชื่อเป็น metadata ของผู้ใช้ ไม่เปลี่ยนหมายเลขช่องและ GPIO ของฮาร์ดแวร์
- สั่งเปิด/ปิดรีเลย์จาก Dashboard ได้เฉพาะบอร์ดในสวนที่ตนมีสิทธิ์ควบคุม และเห็นสถานะคำสั่ง `กำลังส่ง`, `ยืนยันแล้ว`, `หมดเวลา` หรือ `ล้มเหลว`
- การ “ลบ” อุปกรณ์ให้ใช้ soft delete/decommission เพื่อรักษาประวัติ telemetry และ audit log; การลบถาวรให้เป็นสิทธิ์ Admin ตามนโยบาย retention
- Farmer ห้ามสร้าง credential ให้ข้ามสวน ห้ามกำหนด ACL เอง และห้ามนำ `node` identifier ที่ถูกใช้งานใน tenant เดียวกันมาซ้ำ
- เลือกสวน แปลง node ชนิดเซนเซอร์ และช่วงเวลาเพื่อดูข้อมูล
- ตั้งค่าเกณฑ์แจ้งเตือนภายในขอบเขตที่ Admin อนุญาต
- บันทึกกิจกรรมสวน เช่น การให้น้ำ ใส่ปุ๋ย ฝนตก การออกดอก ติดผล เก็บเกี่ยว โรค/แมลง และหมายเหตุ เพื่อเทียบกับข้อมูลเซนเซอร์
- ส่งออกข้อมูลของตนเองเป็น CSV/XLSX ตามช่วงเวลา
- รับทราบ ปิด หรือใส่หมายเหตุในเหตุการณ์แจ้งเตือน

### 3.3 การแยกข้อมูล

- ใช้แนวคิด multi-tenant แบบมี `tenant_id` หรือ `owner_id` และบังคับ authorization ที่ backend ทุก endpoint
- ห้ามพึ่งการซ่อนเมนูที่ frontend เป็นกลไกความปลอดภัย
- ทุก query ต้องตรวจสอบ ownership/scope เพื่อป้องกัน IDOR และการเข้าถึงข้อมูลข้ามบัญชี

## 4. Functional Requirements

### 4.1 Authentication และความปลอดภัยบัญชี

- มี Landing page สาธารณะพร้อม Header/Navigation ที่มีเมนู `หน้าหลัก`, `เกี่ยวกับระบบ`, `เข้าสู่ระบบ` และ `สมัครสมาชิก`
- แบบฟอร์มสมัครสมาชิกอย่างน้อยประกอบด้วย ชื่อ-นามสกุล อีเมล เบอร์โทรศัพท์ (ถ้าจำเป็น) รหัสผ่าน ยืนยันรหัสผ่าน ชื่อสวนเบื้องต้น และการยอมรับเงื่อนไข/นโยบายความเป็นส่วนตัว
- ตรวจว่าอีเมลไม่ซ้ำ ตรวจรูปแบบและความแข็งแรงของรหัสผ่าน และป้องกัน bot/rate abuse ตามความเหมาะสม
- หลังสมัครให้สร้างบัญชีสถานะ `PENDING_VERIFICATION` และส่งลิงก์ยืนยันแบบ token ใช้ครั้งเดียว มีวันหมดอายุ และเก็บ token ในฐานข้อมูลแบบ hash
- บัญชีสามารถเปลี่ยนจาก `PENDING_VERIFICATION` เป็น `ACTIVE` ได้ด้วยหนึ่งในสองช่องทาง: (1) ผู้สมัครกดลิงก์ยืนยันอีเมลสำเร็จ หรือ (2) Admin ตรวจสอบและอนุมัติบัญชีโดยตรง โดยไม่ต้องรอให้ผู้สมัครกดลิงก์ก่อน
- รองรับสถานะอย่างน้อย `PENDING_VERIFICATION`, `ACTIVE`, `REJECTED` และ `SUSPENDED` พร้อมกำหนด transition ที่อนุญาต
- เก็บ `email_verified_at`, `admin_approved_at`, `admin_approved_by` และ `activation_method` (`EMAIL_LINK` หรือ `ADMIN_APPROVAL`) เพื่อให้ตรวจสอบที่มาของการเปิดบัญชีย้อนหลังได้
- ผู้ใช้ที่ยังไม่ `ACTIVE` เข้าสู่ Dashboard ไม่ได้ และหน้า Login ต้องแสดงข้อความสถานะที่เหมาะสมโดยไม่เปิดเผยข้อมูลบัญชีเกินจำเป็น
- ส่งอีเมลแจ้งผู้สมัครเมื่อบัญชีเปิดใช้งานผ่านลิงก์ เมื่อ Admin อนุมัติ หรือเมื่อถูกปฏิเสธ โดยเหตุผลภายในของ Admin ไม่จำเป็นต้องเปิดเผยทั้งหมด
- รองรับ secure session หรือ access token อายุสั้นร่วมกับ refresh token rotation โดยอธิบายเหตุผลที่เลือก
- hash รหัสผ่านด้วย Argon2id หรือมาตรฐานที่เหมาะสม
- มี forgot/reset password, account lockout/rate limit และบันทึกประวัติการเข้าสู่ระบบ
- รองรับ MFA สำหรับ Admin เป็นอย่างน้อย
- ใช้ secure cookie เมื่อเลือก cookie-based authentication และป้องกัน CSRF/XSS/CORS อย่างเหมาะสม

### 4.2 การจัดการโครงสร้างสวน

- โครงสร้างหลัก: ผู้ใช้/องค์กร → สวน → แปลงหรือโซน → Weather Station/Gateway → Soil Sensor → sensor channel
- เก็บชื่อสวน ที่ตั้ง พิกัด ขนาดพื้นที่ พันธุ์ทุเรียน อายุแปลง จำนวนต้น และ timezone
- แสดงตำแหน่งอุปกรณ์บนแผนที่เมื่อมีพิกัด โดยไม่บังคับใช้บริการแผนที่แบบเสียเงิน
- รองรับการย้ายอุปกรณ์และเก็บประวัติช่วงเวลาที่อุปกรณ์อยู่ในแต่ละตำแหน่ง
- แต่ละแปลงรองรับ Weather Station อย่างน้อยหนึ่งสถานี เจ้าของสวนที่มีหลายแปลงจึงมีหลายสถานี และ Data Model ยอมให้มากกว่าหนึ่งสถานีต่อแปลงในอนาคต แต่ละสถานีมี `station_id` ถาวรและ Soil Sensor แต่ละตัวมี `sensor_id` ถาวรของตนเอง
- ห้ามสร้าง composite ID จาก `station_id + sensor_id`; เก็บความสัมพันธ์ใน `sensor_assignments` พร้อม `valid_from`/`valid_to` เพื่อรองรับการย้าย Sensor ในอนาคต
- Soil Sensor ขั้นต่ำมี 2 ชนิด: `SOIL_TH` อ่านอุณหภูมิ/ความชื้นดิน และ `SOIL_7_IN_1` อ่านอุณหภูมิ ความชื้น EC pH N P K
- Data Model ไม่จำกัดจำนวน Soil Sensor แบบตายตัว แต่ต้องมีค่า configuration เช่น `max_sensors_per_station`, `max_payload_bytes` และ `max_batch_size` ตามข้อจำกัด RS485/Modbus, กำลังไฟ, polling time และหน่วยความจำฮาร์ดแวร์จริง

### 4.3 Dashboard เกษตรกร

- มีส่วน `จัดการอุปกรณ์` สำหรับเพิ่ม ดู แก้ไข และยกเลิกอุปกรณ์ โดยทุกคำสั่งตรวจ ownership ที่ FastAPI และบันทึก audit log
- ในรายละเอียดอุปกรณ์ให้มีส่วน `ควบคุมรีเลย์` แสดง 4 ช่องคงที่ แต่ละช่องมีหมายเลขช่อง ชื่อที่ Farmer ตั้งเอง สถานะล่าสุด เวลาอัปเดต ปุ่มเปิด/ปิด และสถานะการตอบรับคำสั่ง
- Farmer แก้ไขชื่อรีเลย์และคำอธิบายอุปกรณ์ที่ต่ออยู่ได้ แต่ห้ามเปลี่ยน hardware mapping: Relay 1 = GPIO26, Relay 2 = GPIO27, Relay 3 = GPIO25 และ Relay 4 = GPIO18
- ต้องป้องกันการกดซ้ำระหว่างรอ ACK แสดงกล่องยืนยันก่อนสั่งงานอุปกรณ์ที่ถูกกำหนดเป็น critical load และไม่เปลี่ยน UI เป็น `ON` จนกว่าจะได้รับ reported state/ACK จากบอร์ด
- การ์ดค่าล่าสุด พร้อมหน่วย เวลาอัปเดต และสถานะคุณภาพข้อมูล
- กราฟแนวโน้มตามช่วงเวลา เช่น 24 ชั่วโมง, 7 วัน, 30 วัน และช่วงวันที่กำหนดเอง
- แสดงข้อมูลโดยกรองตามสวน แปลง `station_id` และ `sensor_id` จาก MQTT โดยอย่างน้อยต้องรองรับ ความเร็วลมเฉลี่ย 5 นาที, ทิศทางลมเป็นองศา, ทิศทางลมภาษาไทยที่ backend คำนวณ, ความเข้มแสง, อุณหภูมิอากาศ, ความชื้นสัมพัทธ์ในอากาศ, อุณหภูมิดิน, ความชื้นดิน, EC, pH, N, P และ K
- แสดงหน่วยมาตรฐาน เช่น m/s, degree, lux, °C, %, µS/cm หรือหน่วยที่กำหนดสำหรับ EC และ mg/kg หรือหน่วยที่ฮาร์ดแวร์ใช้สำหรับ N/P/K โดยห้ามเดาหน่วยเมื่อ payload ไม่ได้ระบุ; ให้กำหนดหน่วยใน sensor metadata หรือ payload schema
- รองรับกรณีบาง node ไม่มี sensor บางชนิด และไม่แสดงค่า `0` แทนข้อมูลที่หาย
- แสดงสถานะ online/offline และเวลาที่ได้รับข้อมูลล่าสุด
- สรุปค่า min/max/average และจำนวนข้อมูลที่ขาดหาย
- เปรียบเทียบเซนเซอร์/แปลง/ช่วงเวลาได้ โดยจำกัดจำนวน series เพื่อรักษาประสิทธิภาพ
- มี loading, empty, stale-data และ error state ที่เข้าใจง่าย
- ใช้สีและข้อความร่วมกัน ไม่สื่อสถานะด้วยสีเพียงอย่างเดียว

### 4.4 MQTT และ IoT Ingestion

> ให้ถือ Production per-sensor Schema `2.0` เป็นรูปแบบหลักในการพัฒนา ห้ามเลือก Legacy `node/zone/env/npk` เป็น Schema หลัก

- กำหนด Production topic convention ดังนี้:

```text
durian/{tenant_id}/{farm_id}/{plot_id}/{station_id}/weather
durian/{tenant_id}/{farm_id}/{plot_id}/{station_id}/soil/{sensor_id}
durian/{tenant_id}/{farm_id}/{plot_id}/{station_id}/status
durian/{tenant_id}/{farm_id}/{plot_id}/{station_id}/event
durian/{tenant_id}/{farm_id}/{plot_id}/{station_id}/relay/command
durian/{tenant_id}/{farm_id}/{plot_id}/{station_id}/relay/command_ack
durian/{tenant_id}/{farm_id}/{plot_id}/{station_id}/relay/state
```

- Weather Station/Gateway แต่ละตัวใช้ MQTT credential ของตนและ publish/subscribe ได้เฉพาะ station topic prefix ตาม ACL; Soil Sensor แบบต่อสายไม่ต้องมี MQTT credential แต่ต้องมี `sensor_id` และ assignment ใน registry ส่วน Sensor ที่ publish MQTT ได้เองในอนาคตต้องมี credential ของตน
- payload ต้องรองรับ JSON จากฮาร์ดแวร์ปัจจุบันซึ่งมี `node`, `zone`, `time`, `env` และ `npk` และควรเพิ่ม `schema_version`, `message_id` หรือ `sequence` ในรุ่นถัดไปเพื่อรองรับ validation และ deduplication
- Payload รุ่นใหม่ต้องมี common envelope ได้แก่ `schema_version`, `message_id`, `plot_id`, `station_id`, `sequence`, `observed_at` และ `readings`; Soil message ต้องเพิ่ม `sensor_id` และ `sensor_type`
- `sequence` เพิ่มต่อเนื่องต่อ publisher/topic, `observed_at` ใช้ ISO 8601 พร้อม timezone และ Server สร้าง `received_at` เอง
- รองรับ 3 schema: Legacy `env/npk`, Batch `2.0-batch` ที่มี `weather` + `soil_sensors[]` และ Production `2.0` ที่ส่ง Weather/Soil แยกราย topic
- สำหรับ Production ให้เลือก per-sensor message เป็นค่าเริ่มต้น เพราะ retry, validation, offline detection และข้อมูลขาดแยกกันได้ ส่วน Batch ใช้ในช่วงเปลี่ยนผ่านและต้องจำกัด `max_batch_size`/`max_payload_bytes`
- `SOIL_TH` อนุญาตเฉพาะ `soil_temperature`, `soil_moisture`; `SOIL_7_IN_1` อนุญาต `soil_temperature`, `soil_moisture`, `soil_ec`, `soil_ph`, `soil_n`, `soil_p`, `soil_k`
- แต่ละ reading รุ่นใหม่มี `value`, `unit` และ optional `quality`; หากอ่านไม่ได้ให้เว้น field หรือส่ง `value: null` พร้อม quality/error ห้ามใช้ `0` แทนข้อมูลหาย
- ตรวจสอบ schema, ชนิดข้อมูล, หน่วย, device identity, timestamp และค่าที่อยู่นอกช่วงก่อนบันทึก
- ป้องกันข้อมูลซ้ำด้วย device_id + sequence หรือ message_id และรองรับข้อความมาถึงผิดลำดับ
- กำหนด QoS, retained message, Last Will and Testament และ offline detection อย่างชัดเจน
- เก็บเวลาจากอุปกรณ์ (`observed_at`) แยกจากเวลาที่ server รับ (`received_at`) และจัดเก็บเวลาเป็น UTC
- quarantine ข้อความที่ไม่ผ่าน validation และมี metric/log สำหรับตรวจสอบ
- การส่งคำสั่งกลับอุปกรณ์ต้องมี command ID, authorization, acknowledgement, timeout และ audit log; ห้ามเปิด remote control โดยไม่มีมาตรการ fail-safe
- ใช้ Eclipse Mosquitto เป็น MQTT Broker และเปิดสู่ภายนอกเฉพาะ `8883/TCP` ผ่าน University Firewall สำหรับ MQTT over TLS
- ห้ามเปิด `1883` สู่ Internet ห้าม anonymous access และต้องมี credential/ACL รายอุปกรณ์ พร้อม connection/message limits, persistence และ security log

ตัวอย่าง Batch Payload ช่วงเปลี่ยนผ่าน:

```json
{
  "schema_version": "2.0-batch",
  "message_id": "01JZ7C2M6Q8V4K1T9H3R5N0PXA",
  "plot_id": "plot_01",
  "station_id": "ws_001",
  "sequence": 12450,
  "observed_at": "2026-06-25T14:30:00+07:00",
  "weather": {
    "air_temperature": { "value": 31.5, "unit": "degC", "quality": "valid" },
    "air_relative_humidity": { "value": 68.2, "unit": "%RH", "quality": "valid" }
  },
  "soil_sensors": [
    {
      "sensor_id": "soil_001",
      "sensor_type": "SOIL_TH",
      "observed_at": "2026-06-25T14:29:56+07:00",
      "readings": {
        "soil_temperature": { "value": 28.1, "unit": "degC", "quality": "valid" },
        "soil_moisture": { "value": 42.5, "unit": "%", "quality": "valid" }
      }
    }
  ]
}
```

ตัวอย่าง Production Weather Payload ที่ส่งไปยัง `.../{station_id}/weather`:

```json
{
  "schema_version": "2.0",
  "message_id": "01JZ7C2M6Q8V4K1T9H3R5N0PXB",
  "plot_id": "plot_01",
  "station_id": "ws_001",
  "sequence": 8801,
  "observed_at": "2026-06-25T14:30:00+07:00",
  "readings": {
    "air_temperature": { "value": 31.5, "unit": "degC", "quality": "valid" },
    "air_relative_humidity": { "value": 68.2, "unit": "%RH", "quality": "valid" },
    "wind_speed_avg_5m": { "value": 1.2, "unit": "m/s", "quality": "valid" },
    "wind_direction_deg": { "value": 180, "unit": "degree", "quality": "valid" },
    "illuminance": { "value": 45000, "unit": "lux", "quality": "valid" }
  }
}
```

ตัวอย่าง Production Soil Payload ที่ส่งไปยัง `.../{station_id}/soil/{sensor_id}`:

```json
{
  "schema_version": "2.0",
  "message_id": "01JZ7C2M6Q8V4K1T9H3R5N0PXC",
  "plot_id": "plot_01",
  "station_id": "ws_001",
  "sensor_id": "soil_002",
  "sensor_type": "SOIL_7_IN_1",
  "sequence": 5320,
  "observed_at": "2026-06-25T14:29:58+07:00",
  "readings": {
    "soil_temperature": { "value": 28.3, "unit": "degC", "quality": "valid" },
    "soil_moisture": { "value": 44.2, "unit": "%", "quality": "valid" },
    "soil_ec": { "value": 1200, "unit": "uS/cm", "quality": "valid" },
    "soil_ph": { "value": 6.5, "unit": "pH", "quality": "valid" },
    "soil_n": { "value": 40, "unit": "mg/kg", "quality": "valid" },
    "soil_p": { "value": 20, "unit": "mg/kg", "quality": "valid" },
    "soil_k": { "value": 30, "unit": "mg/kg", "quality": "valid" }
  }
}
```

Ingestor ต้องตรวจว่า `station_id` ใน topic/payload ตรงกับ authenticated device และ `sensor_id` มี assignment กับสถานีนั้นที่ครอบคลุม `observed_at` ห้ามเชื่อ ID ใน payload อย่างเดียว วิธีนี้ต้องรองรับข้อความมาช้าหลัง reassign ข้อมูล Legacy `npk` ต้อง map ไปยัง Soil Sensor ที่ลงทะเบียนไว้ล่วงหน้า ห้ามสร้าง Sensor ใหม่ทุกข้อความ

#### 4.4.1 MQTT Relay Command และ State

- ใช้ topic `durian/{tenant_id}/{farm_id}/{plot_id}/{station_id}/relay/command`, `/relay/command_ack` และ `/relay/state`
- FastAPI ต้องตรวจ role, farm membership, device ownership, relay channel และ device online status ก่อน publish คำสั่ง
- คำสั่งต้องมี `command_id`, `relay_channel` (1-4), `desired_state` (`ON`/`OFF`), `issued_at`, `expires_at` และผู้สั่งใน audit record; ห้ามเชื่อ user ID ที่ client ใส่มาเอง
- บอร์ดต้องตอบ ACK ที่มี `command_id`, `accepted`, `relay_channel`, `reported_state`, `executed_at` และ `error_code`/`message` เมื่อไม่สำเร็จ
- UI ต้องแยก `desired_state` ออกจาก `reported_state`; หากหมดเวลาแล้วไม่ได้ ACK ให้แสดง `UNKNOWN/TIMEOUT` ไม่ถือว่าคำสั่งสำเร็จ
- เมื่ออุปกรณ์ reconnect ต้อง publish state ของรีเลย์ทั้ง 4 ช่องใหม่ เพื่อให้ Dashboard sync กับสถานะจริง
- กำหนดนโยบาย boot/reconnect/fail-safe ของแต่ละช่อง เช่นค่าเริ่มต้น `OFF`, restore previous state หรือ manual-only โดยค่าเริ่มต้นสำหรับ MVP ให้เป็น `OFF` และต้องยืนยันกับข้อกำหนดหน้างานก่อนใช้งานจริง

ตัวอย่างคำสั่ง:

```json
{
  "schema_version": "1.0",
  "command_id": "cmd_01JXYZ123",
  "type": "SET_RELAY",
  "relay_channel": 1,
  "desired_state": "ON",
  "issued_at": "2026-08-07T14:30:00+07:00",
  "expires_at": "2026-08-07T14:30:15+07:00"
}
```

ตัวอย่าง ACK/state:

```json
{
  "schema_version": "1.0",
  "command_id": "cmd_01JXYZ123",
  "accepted": true,
  "relay_channel": 1,
  "reported_state": "ON",
  "executed_at": "2026-08-07T14:30:02+07:00",
  "error_code": null
}
```

### 4.4.2 โครงสร้างฮาร์ดแวร์หลักจาก Schematic

- Controller: ESP32 DevKit 38 pin
- Power input: DC 6-12 V ผ่าน LM2596-5.0 เป็น 5 V และ AMS1117-3.3 เป็น 3.3 V
- Relay driver: ULN2003A ขับรีเลย์คอยล์ 5 V จำนวน 4 ช่อง พร้อม LED แสดงสถานะบนบอร์ด
- Relay mapping คงที่: Channel 1/GPIO26, Channel 2/GPIO27, Channel 3/GPIO25, Channel 4/GPIO18
- แต่ละช่องมีหน้าสัมผัส `NO`, `COM`, `NC`; ระบบซอฟต์แวร์ต้องเก็บการตั้งค่าประเภทการต่อ (`NO` หรือ `NC`) เพื่ออธิบายสถานะให้ผู้ใช้ถูกต้อง แต่ห้ามสรุปสถานะโหลดจาก GPIO เพียงอย่างเดียวหากไม่มี feedback sensor
- Interfaces อื่นที่พบในแบบ: RS485, I2C, Analog input 4 ช่อง, Digital I/O, DS3231 RTC และสวิตช์อินพุต 2 ช่อง ให้บันทึกเป็น hardware capability สำหรับการขยายระบบ
- สำหรับปั๊มหรือโหลดกำลังสูง รีเลย์บนบอร์ดควรใช้ควบคุมคอยล์ contactor/วงจรควบคุมที่เหมาะสม ไม่ควรสั่งโหลดมอเตอร์โดยตรงหากยังไม่ได้ตรวจ rating, inrush current, overload protection และการแยกวงจรโดยผู้เชี่ยวชาญไฟฟ้า

Payload `node/zone/env/npk` ของบอร์ดเดิมอยู่ใน **ภาคผนวก A: Legacy Payload** เท่านั้น ห้ามใช้เป็น Schema หลักในการพัฒนาใหม่ โดย Schema หลักคือ Production per-sensor `2.0` และรองรับ Batch `2.0-batch` เฉพาะช่วงเปลี่ยนผ่านตามหัวข้อ 4.4

- Ingestor ต้อง map ชื่อ field เดิมที่มีตัวพิมพ์ใหญ่/เล็กไม่สม่ำเสมอ เช่น `Air_temp` และ `Soil_temp` ไปเป็น canonical field ภายใน เช่น `air_temperature` และ `soil_temperature` โดยเก็บ raw payload ไว้ตรวจสอบย้อนหลัง
- รองรับรูปแบบเวลาเดิม `DD/MM/YYYY HH:mm:ss` แบบ strict สำหรับ compatibility แต่ normalize เป็น UTC โดยใช้ timezone ของสวน; payload รุ่นใหม่ควรใช้ ISO 8601 พร้อม offset เช่น `2026-06-25T14:30:00+07:00`
- ตรวจสอบว่า `node` ถูกลงทะเบียนเป็น Weather Station และผูกกับ `zone`/สวนของ topic นั้นจริงก่อนบันทึก ป้องกันอุปกรณ์ปลอมและข้อมูลข้ามบัญชี
- Legacy adapter แยก `env` เป็น Weather readings และ map `npk` ไปยัง `sensor_id` ของ Soil Sensor แบบ `SOIL_7_IN_1` ที่ลงทะเบียนไว้กับสถานีนั้น ห้ามใช้ `node` เป็น `sensor_id` และห้ามสร้าง Sensor ใหม่ทุกข้อความ

### 4.5 การคำนวณและคุณภาพข้อมูล

- คำนวณ derived metrics เช่น VPD ที่ backend พร้อมระบุสูตร หน่วย และ version ของสูตร
- เก็บสถานะคุณภาพ เช่น valid, suspect, out_of_range, missing และ calibrated
- รองรับ metadata การสอบเทียบ ได้แก่ วันที่ ผู้ดำเนินการ ค่า offset/slope และวันครบกำหนดครั้งถัดไป
- ห้ามลบหรือแก้ raw telemetry โดยตรง; หากต้องปรับแก้ ให้เก็บค่าดิบและค่าที่ผ่านการประมวลผลแยกกัน
- ทำ aggregation/downsampling ตามช่วงเวลา และกำหนด retention policy โดยไม่กระทบข้อมูลดิบที่ต้องใช้ในการวิจัย

### 4.6 Alerts และ Notifications

- ตั้ง threshold แบบสูง/ต่ำ ระยะเวลาที่ผิดปกติต่อเนื่อง และ hysteresis/debounce เพื่อลดการแจ้งเตือนซ้ำ
- แจ้งเตือนกรณี sensor เกินเกณฑ์, node offline, แบตเตอรี่ต่ำ, ข้อมูลไม่เข้าตามรอบ และค่าผิดปกติ
- มีระดับ severity, สถานะ open/acknowledged/resolved, ผู้รับผิดชอบ และประวัติการเปลี่ยนสถานะ
- เริ่มต้นด้วย in-app notification และออกแบบ adapter สำหรับ LINE Messaging API, email หรือช่องทางอื่นในอนาคต
- รองรับ quiet hours และ notification preference รายผู้ใช้

### 4.7 รายงานและงานวิจัย

- สร้างรายงานสรุปรายวัน/สัปดาห์/เดือนของแต่ละสวน
- ส่งออกข้อมูลตามสวน แปลง อุปกรณ์ ตัวแปร และช่วงเวลา พร้อม timezone และหน่วยที่ชัดเจน
- แยกสิทธิ์ชุดข้อมูลวิจัยจากสิทธิ์ใช้งานทั่วไป และทำ anonymization/pseudonymization ก่อนรวมข้อมูลหลายเกษตรกร
- บันทึก provenance เช่น device, calibration, firmware, schema version และสูตรคำนวณ เพื่อให้ผลวิจัยตรวจสอบย้อนหลังได้

### 4.8 Admin Operations

- health dashboard สำหรับ API, MQTT consumer, database, queue และเวลาได้รับ telemetry ล่าสุด
- data-gap report, failed-message report และ device connectivity history
- จัดการค่ามาตรฐาน เช่น sensor type, unit, valid range และ sampling interval
- สำรองและกู้คืนฐานข้อมูล พร้อมกำหนด retention และทดสอบ restore

## 5. Non-functional Requirements

- UI เป็นภาษาไทยก่อน และเตรียม i18n สำหรับภาษาอังกฤษ
- รองรับโทรศัพท์มือถือ แท็บเล็ต และเดสก์ท็อป; เน้นหน้าจอโทรศัพท์ที่เกษตรกรใช้ภาคสนาม
- ปฏิบัติตามหลัก WCAG 2.2 AA เท่าที่เหมาะสม
- API มี OpenAPI documentation, pagination, filtering, sorting และ error format เดียวกัน
- ใช้ UTC ในระบบและแสดงผลตาม timezone ของสวน/ผู้ใช้
- มี structured logging, metrics, tracing/correlation ID และไม่บันทึก secret/รหัสผ่านใน log
- รองรับการเติบโตจากต้นแบบไปยังหลายร้อยสวนโดยแยก MQTT ingestion ออกจาก web API
- กำหนดเป้าหมายประสิทธิภาพและทดสอบด้วยข้อมูลจำลอง เช่น telemetry จำนวนมากและผู้ใช้พร้อมกัน
- มี unit test, integration test, authorization/tenant-isolation test, MQTT ingestion test และ end-to-end test ของเส้นทางสำคัญ
- ปฏิบัติตาม PDPA: data minimization, consent/purpose, retention, export และ deletion workflow โดยไม่ทำลายข้อมูลที่ต้องเก็บตามข้อผูกพันงานวิจัยโดยไม่มีการตรวจสอบ
- Production Web/API ต้องเข้าผ่าน University Firewall/WAF/Reverse Proxy บน `443/TCP` ที่ได้รับอนุมัติเท่านั้น; Application Server ควรรับ traffic จาก Reverse Proxy/เครือข่ายที่กำหนด ส่วน `3000`, `8000`, `5432`, `6379` และ `1880` ต้องไม่เปิดสู่อินเทอร์เน็ต และ SSH ใช้เฉพาะ VPN/Management Network ของมหาวิทยาลัย
- Container ภายในต้องรันแบบ non-root เมื่อทำได้ ใช้ `read_only`, `no-new-privileges`, `cap_drop`, image version แบบ pin และห้าม mount Docker socket โดยไม่จำเป็น

## 6. Data Model ขั้นต่ำ

ออกแบบ ERD และ migration สำหรับ relational entities อย่างน้อย:

- users, roles, permissions, user_roles
- email_verification_tokens, user_approval_history หรือ account_status_history
- tenants หรือ organizations
- farms, plots/zones, farm_memberships
- devices, weather_stations, soil_sensors, device_credentials
- sensor_types และ sensor_assignments ที่มี `sensor_id`, `station_id`, `plot_id`, `valid_from`, `valid_to` พร้อมป้องกัน assignment ช่วงเวลาทับซ้อน
- device_status_history และ device_decommission_records สำหรับการยกเลิกโดย Farmer โดยไม่สูญเสียข้อมูลเดิม
- relay_channels, relay_channel_settings, relay_commands, relay_command_events และ relay_state_history
- sensor_types, sensor_channels, units, calibration_records
- alert_rules, alert_events, notifications
- farm_activities, irrigation_events
- command_requests, command_acknowledgements
- audit_logs, login_history

สร้าง TimescaleDB hypertable อย่างน้อย `sensor_readings`, `device_health_history` และ `raw_mqtt_messages` โดยเชื่อมโยงด้วย tenant_id, farm_id, plot_id, station_id, sensor_id (nullable สำหรับ Weather), sensor_type, metric_key, observed_at, received_at, value, unit และ quality flag

- ใช้ `timestamptz` และจัดเก็บเวลาเป็น UTC
- สร้าง index ตาม query หลัก เช่น `(station_id, metric_key, observed_at DESC)` และ `(sensor_id, metric_key, observed_at DESC)` พร้อม index ที่รองรับ tenant/farm/plot isolation
- สร้าง continuous aggregates สำหรับ 5 นาที 1 ชั่วโมง และ 1 วัน เพื่อใช้กับ Dashboard ระยะยาว
- กำหนด chunk interval, compression/columnstore และ retention จากจำนวน node, sampling interval, query pattern และข้อกำหนดงานวิจัย ห้ามลบข้อมูลดิบอัตโนมัติก่อนนโยบายได้รับอนุมัติ
- ใช้ Database Role แยกอย่างน้อย `migration_role`, `api_role`, `ingestor_role`, `readonly_role` และ `backup_role`; ห้ามให้ FastAPI หรือ Node-RED ใช้ superuser

## 7. API และหน้าจอขั้นต่ำ

สร้าง API contract และหน้าจอสำหรับ:

- Landing page, Login, Register, Verify Email, Registration Status, reset password และ profile
- Farmer dashboard, Weather Station/Soil Sensor CRUD/decommission, assign/reassign Sensor, ตั้งชื่อ Relay 1-4, สั่ง ON/OFF, ดู ACK/reported state, chart explorer, alerts, farm activities และ export
- Farm/plot/Weather Station/Soil Sensor detail, assignment history และ device health
- Admin overview, pending-user approval/rejection, users, farms, devices, sensor metadata, data quality และ audit logs
- API health/readiness และ WebSocket/SSE สำหรับข้อมูลล่าสุด

ทุก endpoint ต้องระบุ method, path, request/response schema, permission, validation, status code และตัวอย่าง error

## 8. โครงสร้างโครงการและ DevOps

- ใช้ monorepo แยก `frontend`, `backend`, `services/mqtt-ingestor`, `infrastructure`, `docs` และ `tests`
- สร้าง Dockerfile, Docker Compose, PostgreSQL/TimescaleDB migration, seed data และคำสั่งเริ่มต้นระบบ
- เพิ่ม service `nginx`, `frontend`, `backend`, `timescaledb`, `mosquitto`, `mqtt-ingestor/node-red`, `worker` และ `redis` ตาม architecture โดยไม่เพิ่ม `cloudflared` และไม่ publish พอร์ตภายในที่ไม่จำเป็น
- ใน production ให้ University Reverse Proxy ส่ง traffic ไปยัง Nginx ผ่าน origin port ที่อนุมัติ; Nginx เชื่อม Next.js/FastAPI ผ่าน `app_net`; FastAPI/Ingestor เชื่อม TimescaleDB ผ่าน `data_net`; Mosquitto เชื่อม FastAPI/Ingestor ผ่าน `iot_net`
- TimescaleDB ใช้ `expose: 5432` ภายในเท่านั้นและห้ามใช้ `ports: 5432:5432`; Nginx/Next.js/FastAPI/Redis/Node-RED editor ก็ห้ามเปิดสาธารณะ
- Mosquitto publish เฉพาะ `8883:8883/TCP` สำหรับอุปกรณ์ภาคสนาม พร้อม TLS, per-device authentication, topic ACL และ limits; ห้าม publish `1883:1883`
- มี development, test และ production configuration แยกกัน
- ใช้ CI ตรวจ lint, type check, test, dependency/security scan และ build
- จัดการ secret ผ่าน environment/secret manager ไม่ commit credential
- กำหนด backup, restore, monitoring และ incident runbook เบื้องต้น

## 9. ลำดับผลลัพธ์ที่ต้องส่งมอบ

ให้ทำงานและรายงานตามลำดับต่อไปนี้:

1. Requirement analysis: สรุปสิ่งที่เข้าใจ สมมติฐาน ข้อขัดแย้ง และคำถามที่ต้องให้เจ้าของระบบตัดสินใจ
2. Architecture Decision Records: เปรียบเทียบและเลือก session/token กับ WebSocket/SSE พร้อมบันทึกเหตุผลของ deployment ที่เลือกแล้ว ได้แก่ Server มหาวิทยาลัย + University Firewall/WAF/Reverse Proxy, Eclipse Mosquitto, PostgreSQL + TimescaleDB และ Docker Compose โดยไม่ใช้ Cloudflare Tunnel
3. System architecture diagram และ data-flow diagram ตั้งแต่อุปกรณ์ถึง Dashboard
4. ERD, time-series schema, Weather Station–Soil Sensor assignment history, retention/downsampling policy และ tenant isolation strategy
5. MQTT topic, ACL, Legacy/Batch/Production per-sensor JSON Schema, QoS/LWT และ retry/idempotency strategy
6. OpenAPI contract และรายการหน้าจอ/สิทธิ์
7. Project scaffold ที่รันได้ พร้อม `.env.example`, migrations และ seed account โดยไม่ใส่ secret จริง
8. พัฒนา vertical slice แรก: Landing page → สมัครสมาชิก → เปิดบัญชีด้วยลิงก์อีเมลหรือ Admin อนุมัติโดยตรง → login → Farmer เพิ่ม Weather Station/Soil Sensor และตั้งชื่อรีเลย์ → assign Sensor เข้าสถานี → รับ Legacy/Production telemetry → บันทึก → Dashboard กรอง `station_id`/`sensor_id` และแยกผู้ใช้ → สั่ง Relay → รับ ACK/reported state → alert
9. เพิ่ม Admin, export, audit, data quality และ farm activity
10. Automated tests, security checklist, deployment guide, backup/restore guide และคู่มือผู้ใช้ภาษาไทย

หลังแต่ละระยะ ให้แสดงไฟล์ที่สร้าง วิธีรัน ผลการทดสอบ และรายการสิ่งที่ยังไม่เสร็จ ห้ามอ้างว่าเสร็จหากยังไม่ได้ทดสอบจริง

## 10. เกณฑ์การยอมรับระบบเบื้องต้น

- ผู้เยี่ยมชมเห็น Landing page และเข้าถึง Login/Register ได้ แต่เข้าถึง Dashboard ไม่ได้
- ผู้สมัครสามารถเข้าสู่ระบบได้เมื่อบัญชีถูกเปิดใช้ด้วยช่องทางใดช่องทางหนึ่ง ได้แก่ ยืนยันผ่านลิงก์อีเมล หรือ Admin อนุมัติโดยตรง โดยไม่บังคับให้ครบทั้งสองช่องทาง; token ใช้ซ้ำหรือหมดอายุแล้วต้องไม่สามารถยืนยันได้
- Admin เห็นคิวผู้สมัครและอนุมัติ/ปฏิเสธรายคนได้ โดยทุกการเปลี่ยนสถานะมี audit log
- เกษตรกร A ไม่สามารถเข้าถึงข้อมูลหรือ identifier ของเกษตรกร B ผ่าน UI หรือ API
- Farmer เพิ่ม/แก้ไข/ยกเลิกอุปกรณ์ในสวนตนเองได้ แต่จัดการอุปกรณ์สวนอื่นไม่ได้ และการยกเลิกไม่ทำลาย telemetry เดิม
- หนึ่งแปลงสร้าง Weather Station ได้หลายสถานี และแต่ละสถานี assign Soil Sensor ชนิด `SOIL_TH`/`SOIL_7_IN_1` ได้หลายตัวภายใต้ขีดจำกัด configuration
- การ reassign Soil Sensor ไม่เปลี่ยน `sensor_id` และเก็บ `valid_from`/`valid_to` ของสถานีเดิม/ใหม่ครบถ้วน
- Farmer ตั้งชื่อ Relay 1-4 ของแต่ละบอร์ดได้โดยไม่เปลี่ยน channel/GPIO mapping และชื่อของสวนหนึ่งไม่ปะปนกับอีกสวน
- คำสั่ง ON/OFF ถูกส่งเฉพาะ device/topic ที่ได้รับสิทธิ์ มี command ID และ audit log; Dashboard แสดงสำเร็จเมื่อได้รับ ACK/reported state เท่านั้น
- หากบอร์ด offline, ACK timeout หรือ reported state ไม่ตรงกับ desired state ระบบต้องแสดงข้อผิดพลาด/สถานะไม่ทราบ ห้ามรายงานว่าสั่งงานสำเร็จ
- payload ตัวอย่างที่มี `env` และ `npk` ถูกตรวจสอบ normalize และแสดงครบตาม node/zone พร้อมหน่วยและเวลาที่ถูกต้อง
- Legacy `npk` ถูก map ไปยัง Soil Sensor ที่ลงทะเบียนไว้ ไม่สร้าง sensor record ใหม่ซ้ำ และ Batch `soil_sensors[]` แยกค่าตาม `sensor_id` ได้ถูกต้อง
- Production Weather/Soil message บน topic แยกกันถูกตรวจ `station_id`, `sensor_id`, `sensor_type`, assignment, metric allowlist, unit, timestamp และ message size ก่อนบันทึก
- Dashboard และ API กรองข้อมูลด้วย tenant/farm/plot scope ร่วมกับ `station_id`/`sensor_id`; การปลอม ID ใน topic หรือ payload ต้องถูกปฏิเสธหรือ quarantine
- telemetry ที่ถูกต้องปรากฏใน Dashboard ของเจ้าของสวนที่ถูกต้อง และข้อมูลซ้ำไม่ถูกบันทึกซ้ำ
- ข้อมูลไม่เข้าตามเวลาที่กำหนดแล้วระบบเปลี่ยน node เป็น offline และสร้าง alert
- Dashboard ระบุเวลาล่าสุด หน่วย และสถานะข้อมูลชัดเจน รวมทั้งทำงานได้เมื่อไม่มีข้อมูล
- Admin จัดการผู้ใช้ สวน อุปกรณ์ และตรวจ audit log ได้
- การส่งออกข้อมูลมีตัวแปร ช่วงเวลา timezone หน่วย และ provenance ครบ
- ระบบเริ่มทำงานผ่าน Docker Compose ได้จากคู่มือ และ test suite ของเส้นทางสำคัญผ่านทั้งหมด
- ตรวจจากภายนอกแล้วไม่พบพอร์ตนอกเหนือจากรายการที่มหาวิทยาลัยอนุมัติ โดย `443/TCP` ให้บริการที่ University Edge/Reverse Proxy และ `8883/TCP` ให้บริการ MQTT/TLS; ต้องไม่พบ `1883`, `1880`, `3000`, `8000`, `5432` หรือ `6379` และ SSH ต้องไม่เข้าถึงได้จาก Internet ทั่วไป
- Mosquitto ปฏิเสธ anonymous client, ปฏิเสธการ publish/subscribe ข้าม topic ACL และรับ ESP32 ผ่าน TLS ที่ `8883` ได้จริง
- Next.js ไม่เชื่อมฐานข้อมูลโดยตรง ทุก query ผ่าน FastAPI และ FastAPI/Node-RED ใช้ Database Role แบบ least privilege
- telemetry ถูกเขียนลง TimescaleDB hypertable และ Dashboard อ่าน continuous aggregate ตามช่วงเวลาได้ถูกต้อง

## 11. ข้อกำหนดในการตัดสินใจของ AI

- หาก requirement สำคัญยังคลุมเครือ ให้ถามคำถามแบบจัดลำดับความสำคัญก่อนตัดสินใจ
- หากจำเป็นต้องสมมติ ให้ระบุสมมติฐานอย่างชัดเจนและทำให้แก้ไขภายหลังได้
- เลือกแนวทางที่เรียบง่ายและตรวจสอบได้สำหรับ MVP แต่ไม่ลดทอน tenant isolation, security, data integrity และ auditability
- อธิบาย trade-off ของการเลือกเทคโนโลยี ไม่เพิ่มบริการใหม่โดยไม่มีเหตุผล
- ใช้ข้อมูลจำลองแทนข้อมูลส่วนบุคคลหรือ credential จริงในการพัฒนาและทดสอบ

## ภาคผนวก A: Legacy Payload สำหรับ Compatibility เท่านั้น

> ห้ามเลือก Payload ชุดนี้เป็น Schema หลักของระบบใหม่ ใช้เฉพาะ adapter สำหรับบอร์ดเดิมจนกว่าจะอัปเกรด Firmware เป็น Schema `2.0`

```json
{
  "node": "node_01",
  "zone": "zone_A",
  "time": "25/06/2026 14:30:00",
  "env": {
    "wind_speed_avg5m": 1.2,
    "wind_dir_deg": 180,
    "wind_dir_th": "ใต้",
    "lux": 45000,
    "Air_temp": 31.5,
    "Air_humi": 68.2
  },
  "npk": {
    "Soil_temp": 28.1,
    "Soil_humi": 42.5,
    "ec": 1200,
    "ph": 6.5,
    "n": 40,
    "p": 20,
    "k": 30
  }
}
```

AI ต้องสร้าง Legacy adapter ที่ map `node` ไปยัง `station_id`, แยก `env` เป็น Weather readings, map `npk` ไปยัง `sensor_id` ของ `SOIL_7_IN_1` ที่ลงทะเบียนไว้ และ normalize เวลา/field/unit ตามข้อกำหนด โดยห้ามสร้าง Station หรือ Sensor ใหม่จากข้อความโดยอัตโนมัติ
