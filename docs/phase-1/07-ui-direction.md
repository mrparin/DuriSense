# UI Direction ด้วย Gridgeist

## Direction

**สถานะ:** User-confirmed และ brand-derived

> DuriSense เป็นพื้นที่ทำงานภาษาไทยสำหรับเกษตรกรที่ต้องตรวจสภาพแปลงและดำเนินการได้รวดเร็ว
> จัดโครงสร้างตามสวน-แปลง-อุปกรณ์ ใช้บรรยากาศสีเขียวที่สุขุมและอบอุ่น และให้ค่าจริง
> สถานะอุปกรณ์ เวลาอัปเดต และงานที่ต้องทำเป็นหลักฐานสำคัญของหน้าจอ

- Structural influence: task-flow grid ตามลำดับ Farm > Plot > Station > Sensor
- Expressive influence: warm, restrained และอ่านชัดกลางแจ้ง
- Product-native motif: telemetry trace, data freshness และ device/relay state
- Grid visibility: Landing ใช้ quiet/invisible grid; workspace ใช้ quiet visible alignment

## Brand Inventory

| Signal | การตัดสินใจ | เหตุผล |
| --- | --- | --- |
| ชื่อ DuriSense | Preserve | เป็นชื่อผลิตภัณฑ์หลัก |
| สัญลักษณ์ทุเรียน + wireless | Preserve | สื่อเกษตรและ IoT โดยตรง |
| เขียว + เหลืองในโลโก้ | Preserve/Evolve | ใช้เขียวเป็น brand และเหลืองเป็น highlight อย่างจำกัด |
| พื้นหลังดำของ `logo.png` | Contextual use | ใช้บน dark-green navigation/hero; ไม่วางตรงบนพื้นขาว |
| Glow ในไฟล์โลโก้ | Limit | ใช้เฉพาะ asset เดิม ไม่กระจาย glow ไปทั่ว UI |
| โทนเขียว-ขาว | Preserve | ผู้ใช้ยืนยันและเหมาะกับเนื้อหาเกษตร |

โลโก้ปัจจุบันเป็น wordmark แนวนอน จึงควรมีพื้นที่คงสัดส่วนและไม่ย่อจนชื่ออ่านไม่ได้
บน mobile สามารถใช้ viewport/crop ที่แสดงเครื่องหมายทุเรียนจาก asset เดิม หรือใช้ wordmark ในพื้นที่กว้าง
โดยไม่บิดสัดส่วน

## Color Roles

ค่าจริงจะถูกปรับหลังตรวจ contrast ใน browser แต่บทบาทเริ่มต้นคือ:

| Role | แนวสี | การใช้งาน |
| --- | --- | --- |
| Brand deep | เขียวเข้ม | navigation, hero overlay, selected emphasis |
| Brand primary | เขียวใบไม้ | primary action, focus/selection |
| Brand highlight | เหลืองทุเรียน | จุดเน้นขนาดเล็กและข้อมูลสำคัญ ไม่ใช้เป็น body text |
| Canvas | ขาว/เทาอมเขียวอ่อนมาก | พื้นอ่านข้อมูล |
| Ink | เทาดำอมเขียว | ข้อความหลัก |
| Info | ฟ้า | สถานะข้อมูล/กำลังทำงาน |
| Warning | อำพัน | stale, pending, attention |
| Danger | แดง | error, destructive, critical alert |

สถานะทุกชนิดใช้ icon/ข้อความร่วมกับสี และ focus indicator ต้องมี contrast ชัด

## Typography

- Font หลัก: Thai-first sans-serif ที่อ่านง่าย เช่น `Noto Sans Thai` พร้อม system fallback
- Body: อย่างน้อย 16px, line-height ประมาณ 1.6
- Compact metadata: ไม่ต่ำกว่า 14px และใช้เฉพาะข้อมูลรอง
- Form control: อย่างน้อย 16px เพื่อป้องกัน mobile zoom และอ่านกลางแจ้งได้
- Heading จำกัดจำนวนระดับและไม่ปรับขนาดตาม viewport width
- ตัวเลข telemetry ใช้ tabular numerals หาก font รองรับ แต่ไม่ใช้ monospace กับข้อความทั่วไป

## Landing Page Composition

1. Header สีเขียวเข้ม พร้อม wordmark และ navigation ที่อ่านชัด
2. Hero แบบ full-bleed ใช้ภาพสวนทุเรียนจริงเป็นพื้นหลังเมื่อมี asset พร้อม overlay
3. H1 ใช้ชื่อ `DuriSense`; คำอธิบายอยู่ใน supporting copy
4. CTA หลัก `เริ่มต้นใช้งาน` และ CTA รอง `เข้าสู่ระบบ`
5. Product evidence แสดงตัวอย่าง Dashboard ที่ระบุว่าเป็นข้อมูลจำลอง
6. อธิบายการไหล Sensor > DuriSense > Farmer ด้วย layout ที่เรียบและสแกนง่าย
7. ประโยชน์แบ่งตามงานจริง: เฝ้าดู, แจ้งเตือน, จัดการอุปกรณ์, ตรวจย้อนหลัง
8. ส่วนโครงการและผู้พัฒนา: Parinya Jansengrat, มหาวิทยาลัยเทคโนโลยีราชมงคลธัญบุรี
9. ช่องทางติดต่อและ CTA ปิดท้าย

Hero ไม่วางข้อความใน card ไม่ใช้ SVG/gradient เป็นภาพหลัก และต้องเห็นส่วนถัดไปเล็กน้อยใน viewport แรก

## Workspace Composition

- Desktop: sidebar + context header + content tracks ที่มี alignment ร่วมกัน
- Mobile: top context + bottom navigation; selector ที่สำคัญอยู่ใกล้ข้อมูล
- Dominant area ของ Dashboard คือสถานะปัจจุบันและสิ่งที่ต้องดำเนินการ ไม่ใช่ KPI ที่แต่งขึ้น
- Latest readings ใช้กลุ่มตาม Weather/Soil พร้อมหน่วย คุณภาพ และเวลาอัปเดต
- กราฟมี legend, unit, empty/stale state และจำกัดจำนวน series
- Relay panel เป็นเครื่องมือเฉพาะ มีขนาดคงที่ ไม่ถูกครอบด้วย card ซ้อน card
- Destructive/decommission และ critical relay command มี confirmation ที่บอกผลกระทบชัด

## Responsive Rules

| Width | การจัดวางหลัก |
| --- | --- |
| ประมาณ 360px | หนึ่งคอลัมน์, bottom nav, selector แบบ drill-down, chart scroll/resize อย่างควบคุม |
| ประมาณ 768px | สอง track สำหรับข้อมูลที่เกี่ยวข้อง, navigation แบบ tablet |
| ประมาณ 1280px | sidebar และ content grid เต็ม, comparison tools แสดงพร้อมกัน |
| ประมาณ 1600px | เพิ่มความกว้างข้อมูลอย่างมีขอบเขต ไม่ขยายตัวอักษรตาม viewport |

- Control ที่กดได้มีเป้าสัมผัสอย่างน้อย 44x44px
- ตารางที่จำเป็นต้องเปลี่ยนเป็น priority rows หรือ horizontal scroll ที่มี label ชัด
- ห้ามย่อ desktop navigation หรือ relay controls จนแตะยาก
- รองรับข้อความไทยยาว, browser zoom และ dynamic data โดยไม่ซ้อนทับ

## State Inventory

| Surface | States |
| --- | --- |
| Authentication | idle, validating, submitting, success, invalid, pending, suspended, rate-limited |
| Telemetry | loading, live, stale, missing, suspect, out-of-range, error |
| Device | online, offline, reconnecting, decommissioned, credential-issued |
| Relay | off, on, pending, acknowledged, failed, timeout, expired, mismatch, disabled |
| Alert | open, acknowledged, resolved, muted |
| Export | queued, processing, ready, expired, failed |

## Verification Plan สำหรับระยะ Implement

- Render จริงที่ 360, 768, 1280 และ 1600px
- ตรวจ navigation, register/login, filter, chart, device CRUD และ relay flow
- ตรวจ keyboard order, visible focus, accessible name, contrast และ Escape/focus restore ใน dialog
- ตรวจ loading/empty/error/stale/disabled/destructive และข้อมูลภาษาไทยยาว
- ตรวจ `prefers-reduced-motion` และ overflow
- แยกผล automated checks ออกจากข้อสรุปที่ต้องอาศัยผู้ใช้จริงหรือผู้เชี่ยวชาญภาคสนาม

