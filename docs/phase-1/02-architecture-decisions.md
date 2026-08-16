# Architecture Decision Records

## ADR-001: ใช้ Monorepo

**สถานะ:** Accepted

ใช้โครงสร้าง `frontend`, `backend`, `services`, `packages`, `infrastructure`, `migrations`,
`tests` และ `docs` ใน repository เดียว เพื่อให้ contract, migration, simulator และ integration test
เปลี่ยนพร้อมกันได้ โดยแต่ละ runtime service ยังมี dependency และ container แยกกัน

## ADR-002: ใช้ Next.js และ FastAPI แยกหน้าที่

**สถานะ:** Accepted

- Next.js App Router + TypeScript รับผิดชอบ presentation และ browser interaction
- FastAPI รับผิดชอบ authentication, authorization, business rules, API และ SSE
- Browser ไม่เชื่อม PostgreSQL หรือ MQTT โดยตรง
- การซ่อนเมนูใน frontend ไม่ถือเป็น authorization

## ADR-003: ใช้ Opaque Session Cookie สำหรับ Web MVP

**สถานะ:** Accepted

เลือก session แบบ server-managed แทนการเก็บ bearer token ใน browser เพราะ DuriSense ระยะแรกเป็น
first-party web application และ Admin ต้อง revoke session ได้รวดเร็ว

- Cookie: `HttpOnly`, `Secure`, `SameSite=Lax`, จำกัด path/domain
- Session ID เป็นค่า random; เก็บเฉพาะ hash และ metadata ฝั่ง server
- Phase 1B ใช้ PostgreSQL เก็บ active session/TTL และ login/security history เพื่อให้ revoke,
  privilege change และ audit อยู่ใน transaction boundary เดียวกัน
- เพิ่ม Redis เป็น session cache เมื่อมีผลวัด latency/scale รองรับ โดยคง opaque cookie contract เดิม
- คำขอที่เปลี่ยนข้อมูลใช้ CSRF token และตรวจ `Origin`
- Rotate session หลัง login, privilege change และ password reset
- API สำหรับ client ภายนอกในอนาคตให้เพิ่ม OAuth2/OIDC แยกจาก Web session

## ADR-004: ใช้ SSE สำหรับ Dashboard Realtime

**สถานะ:** Accepted

เลือก Server-Sent Events เพราะข้อมูลหลักไหลจาก server ไป browser ทางเดียว ส่วนคำสั่งรีเลย์ใช้ REST
และรับสถานะกลับผ่าน SSE ทำให้ reconnect, proxy และ authorization เรียบง่ายกว่า WebSocket

- SSE ส่ง latest telemetry, alert, device status และ relay command state
- Client reconnect ด้วย event ID และ fallback เป็น polling ได้
- พิจารณา WebSocket ใหม่เมื่อมี use case ที่ต้องสื่อสารสองทางต่อเนื่องจริง

## ADR-005: ใช้ PostgreSQL + TimescaleDB ฐานเดียว

**สถานะ:** Accepted

ข้อมูลผู้ใช้/สวน/สิทธิ์ใช้ relational tables และ telemetry ใช้ hypertables ในฐานเดียว
เพื่อรักษา foreign key, transaction boundary และ query scope โดยไม่ใช้ InfluxDB หรือ Supabase

## ADR-006: ใช้ Eclipse Mosquitto และ Production Schema 2.0

**สถานะ:** Accepted

- Broker: Eclipse Mosquitto 2.x ที่ pin version หลังทดสอบ
- External MQTT: TLS `8883/TCP` เท่านั้น
- Credential และ ACL แยกตาม Weather Station/Gateway
- Schema หลัก: per-device `2.0`
- Batch `2.0-batch`: ใช้ช่วงเปลี่ยนผ่าน
- Legacy `node/zone/env/npk`: ผ่าน compatibility adapter เท่านั้น

## ADR-007: Simulator และ Hardware ใช้ Contract เดียวกัน

**สถานะ:** Accepted

Simulator ไม่เรียก API พิเศษ แต่เชื่อม Mosquitto ด้วย credential ของ simulated device และ publish/subscribe
topic เดียวกับฮาร์ดแวร์จริง Device registry ระบุ `connection_mode` เป็น `SIMULATED` หรือ `HARDWARE`
เพื่อให้สลับอุปกรณ์ได้โดยไม่แก้ Dashboard, API หรือ database schema

## ADR-008: ใช้ Python MQTT Ingestor แยกจาก FastAPI

**สถานะ:** Accepted

Ingestor เป็น service แยกเพื่อ scale และ restart ได้โดยไม่กระทบ Web API ใช้ shared JSON Schema/contracts
กับ simulator และ backend Node-RED อาจใช้ในห้องปฏิบัติการ แต่ไม่เป็นช่องทางข้าม authorization
หรือ runtime หลักของ MVP

## ADR-009: ใช้ Docker Compose บน Server มหาวิทยาลัย

**สถานะ:** Accepted

University Firewall/WAF/Reverse Proxy เป็น public web edge และ Nginx เป็น application ingress
ภายใน server ใช้ `edge_net`, `app_net`, `iot_net` และ `data_net` โดยไม่เปิดพอร์ตภายใน
`3000`, `8000`, `5432`, `6379`, `1880` หรือ MQTT `1883` สู่ Internet

## ADR-010: Remote Control เริ่มด้วย Simulator

**สถานะ:** Accepted

ซอฟต์แวร์รองรับ hardware จริงตั้งแต่ contract แรก แต่ production command ไปยังโหลดจริงจะยังไม่เปิด
จนกว่าจะผ่าน permission test, timeout/offline test, reconnect state sync, fail-safe review,
electrical review และ field acceptance test
