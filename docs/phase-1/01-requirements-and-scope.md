# Requirement และขอบเขต

## เป้าหมาย

DuriSense เป็น Web Portal ภาษาไทยสำหรับเกษตรกรและผู้ดูแลระบบ ใช้ติดตามสภาพอากาศ
และสภาพดินในแปลงทุเรียน จัดการโครงสร้างสวนและอุปกรณ์ รับการแจ้งเตือน และส่งคำสั่ง
ควบคุมรีเลย์อย่างตรวจสอบย้อนหลังได้ โดยระบบต้องรองรับหลายบัญชีและไม่เปิดเผยข้อมูลข้ามสวน

## ผู้ใช้งาน

| ผู้ใช้ | งานหลัก | ขอบเขตข้อมูล |
| --- | --- | --- |
| Visitor | อ่านข้อมูลโครงการ สมัครสมาชิก และเข้าสู่ระบบ | ข้อมูลสาธารณะเท่านั้น |
| Farmer | จัดการสวน อุปกรณ์ ข้อมูลเซนเซอร์ การแจ้งเตือน และรีเลย์ | เฉพาะสวนที่เป็นสมาชิกและมีสิทธิ์ |
| Admin | อนุมัติบัญชี จัดการข้อมูลระบบ และตรวจ audit/health | ตามสิทธิ์ผู้ดูแลระบบ |
| Technician | เตรียมรองรับการติดตั้งและสอบเทียบ | เฉพาะอุปกรณ์ที่ได้รับมอบหมาย |
| Researcher | เตรียมรองรับข้อมูลวิจัย | เฉพาะ dataset ที่อนุมัติและลดการระบุตัวตนแล้ว |

## โครงสร้างข้อมูลหลัก

```text
Tenant / Organization
└── Farm
    └── Plot / Zone
        └── Weather Station / Gateway
            └── Soil Sensor
                └── Sensor Channel
```

- หนึ่งบัญชีดูแลหลายสวนได้ และหนึ่งสวนมีสมาชิกหลายคนได้
- หนึ่งแปลงมี Weather Station ได้มากกว่าหนึ่งสถานี
- หนึ่ง Weather Station มี Soil Sensor ได้หลายตัวภายใต้ configuration ของฮาร์ดแวร์
- `station_id` และ `sensor_id` เป็นตัวตนถาวร
- การย้าย Soil Sensor ใช้ assignment history ที่มี `valid_from` และ `valid_to`
- การยกเลิกอุปกรณ์ใช้ decommission/soft delete เพื่อรักษาประวัติ

## Vertical Slice ที่ต้องทำงานได้

1. Visitor เปิด Landing page และสมัครสมาชิก
2. บัญชีเปิดใช้งานผ่านลิงก์อีเมลหรือ Admin อนุมัติอย่างใดอย่างหนึ่ง
3. Farmer เข้าสู่ระบบและสร้างสวน แปลง Weather Station และ Soil Sensor
4. Farmer assign Soil Sensor ไปยัง Weather Station
5. Simulator หรือฮาร์ดแวร์จริง publish telemetry ตาม MQTT Schema `2.0`
6. Ingestor ตรวจ identity, schema, assignment, unit, timestamp และข้อมูลซ้ำ
7. Dashboard แสดงค่าล่าสุด กราฟ คุณภาพข้อมูล และสถานะ online/offline
8. Farmer ตั้งชื่อ Relay 1-4 และส่งคำสั่ง ON/OFF
9. Relay Simulator หรือฮาร์ดแวร์จริงตอบ ACK และ reported state
10. ระบบแสดงผลคำสั่งและบันทึก audit log

## ขอบเขต MVP

- Landing page, Login, Register, Verify Email และ Registration Status
- Farmer dashboard และตัวกรอง Farm/Plot/Station/Sensor
- Farm, Plot, Weather Station, Soil Sensor และ assignment CRUD
- Telemetry latest/series พร้อม loading, empty, stale และ error state
- Relay 4 ช่อง พร้อม `PENDING`, `ACKNOWLEDGED`, `FAILED`, `TIMEOUT`,
  `EXPIRED` และ `STATE_MISMATCH`
- Admin pending-user queue และ audit log ขั้นต่ำ
- In-app alert สำหรับข้อมูลขาดช่วงและอุปกรณ์ offline
- Sensor Simulator และ Relay Simulator
- Integration point สำหรับ hardware จริงโดยไม่เปลี่ยน frontend contract

## นอกขอบเขต MVP

- Automation schedule สำหรับปั๊มหรือวาล์ว
- การเปิดโหลดกำลังสูงจริงก่อนผ่านการตรวจหน้างานและ fail-safe test
- LINE/email notification เต็มรูปแบบนอกเหนือจาก email บัญชี
- Advanced analytics, prediction และ recommendation
- Research data portal และการรวม dataset หลายสวน
- Kubernetes หรือ multi-region deployment

## สมมติฐานที่ใช้ได้ในระยะเริ่มต้น

- ใช้ข้อมูลตัวอย่างที่ระบุชัดว่าเป็นข้อมูลจำลอง
- Farm timezone เริ่มต้นเป็น `Asia/Bangkok` แต่เก็บเวลาในฐานข้อมูลเป็น UTC
- รีเลย์เริ่มต้นเป็น `OFF` และคำสั่งมีอายุ 15 วินาที
- Dashboard ใช้ SSE สำหรับข้อมูลใกล้เวลาจริง และ REST สำหรับการแก้ไข/ส่งคำสั่ง
- การเชื่อมต่อ hardware ใช้ MQTT/TLS และ contract เดียวกับ simulator
- ช่องทางแจ้งเตือนแรกคือ in-app notification
- ตัวเลขขีดจำกัด sensor, sampling interval และ retention จะเป็น configuration
  จนกว่าจะมีผลทดสอบฮาร์ดแวร์จริง

## ประเด็นที่ต้องยืนยันก่อน Production

- จำนวนสวน สถานี และ sampling interval ที่คาดการณ์
- Retention ของ raw telemetry และ backup RPO/RTO
- Domain, origin port, source restriction และ TLS termination จากฝ่าย IT มหาวิทยาลัย
- MQTT certificate/credential lifecycle และรายการ IP/port ที่ได้รับอนุมัติ
- Rating ของโหลด รีเลย์ contactor interlock และ manual override ที่หน้างาน
- PDPA consent, retention, export และ research approval workflow

