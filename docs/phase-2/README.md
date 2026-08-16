# DuriSense Frontend Foundation Delivery Record

> ชื่อโฟลเดอร์ `phase-2` เป็นชื่อรอบส่งมอบเดิม ปัจจุบันงานชุดนี้ถูกจัดเป็น
> **Phase 1A: Frontend Foundation** ตาม Phase หลักใน `structure.md`
> และไม่ใช่ Phase 2: Field Operations ดูแผนหลักที่ `docs/ROADMAP.md`

## Direction

DuriSense ใช้โครงสร้าง task-flow ตาม Farm > Plot > Station > Sensor
ผสมบรรยากาศสีเขียวที่สุขุมกับสีเหลืองทุเรียน และให้ข้อมูลจริง สถานะอุปกรณ์
เวลาอัปเดต และงานที่ต้องทำเป็นจุดเด่นของหน้าจอ

ข้อจำกัดที่รักษาไว้:

- ภาษาไทยเป็นหลัก
- สีเขียวและขาว พร้อม semantic blue/amber/red
- Body และ form control ขนาด 16px ขึ้นไป
- Touch target อย่างน้อย 44px
- Landing page ใช้ภาพสวนจริงเป็น full-bleed Hero
- Mobile layout จัดลำดับใหม่ ไม่ย่อ desktop ลงตรง ๆ
- Landing page ไม่แสดงชื่อสวน ชื่อแปลง ค่าเซนเซอร์ หรือสถานะอุปกรณ์
- Logo เดิมถูกใช้งานโดยไม่ดัดแปลง

## Implementation

### Monorepo scaffold

```text
frontend/                  Next.js App Router frontend
backend/                   FastAPI placeholder
services/mqtt-ingestor/    MQTT ingestor placeholder
services/simulator/        Sensor/relay simulator placeholder
packages/contracts/        Shared contract placeholder
infrastructure/            Deployment placeholder
tests/                     Cross-service test placeholder
```

### Public routes

| Route | สถานะ |
| --- | --- |
| `/` | Landing page พร้อม Hero, capabilities, อุปกรณ์ที่รองรับ, data flow และคู่มือเริ่มต้น |
| `/about` | ที่มา หลักการ และผู้พัฒนาระบบ |
| `/guide` | คู่มือใช้งานฉบับละเอียด พร้อมสารบัญ การตั้งค่าอุปกรณ์ สถานะข้อมูล รีเลย์ และ troubleshooting |
| `/login` | ฟอร์มเข้าสู่ระบบจำลอง |
| `/register` | ฟอร์มสมัครสมาชิกและ password requirements |
| `/forgot-password` | Generic recovery response |
| `/reset-password` | ตั้งรหัสผ่านใหม่ พร้อม valid, expired, invalid, submitting และ success state |
| `/registration-status` | Pending, active, rejected และ resend state |
| `/profile` | ฟอร์มโปรไฟล์ผู้ใช้แบบ UI simulation |
| `/verify-email` | Success state |
| `/verify-email?state=loading` | Loading state |
| `/verify-email?state=expired` | Expired state |
| `/verify-email?state=used` | Used-token state |
| `/verify-email?state=invalid` | Invalid-token state |

ทุก Authentication route เป็น UI simulation เท่านั้น ไม่มีข้อมูลถูกส่งไป backend

State simulation เพิ่มเติม:

- `/login?state=invalid|pending|suspended|rate-limited`
- `/register?state=duplicate`
- `/registration-status?state=pending|active|rejected`
- `/forgot-password?state=rate-limited`
- `/reset-password?state=expired|invalid`

## Pinned Dependencies

- Next.js `16.3.1`
- React / React DOM `19.2.8`
- Lucide React `1.28.0`
- TypeScript `6.0.3`
- ESLint `9.39.2`

Next.js ถูกอัปเดตจาก `16.2.12` เป็น `16.3.1` หลัง npm audit พบ advisory
ใน PostCSS/Sharp ที่แก้ได้ด้วยรุ่นใหม่ โดยไม่ได้ใช้ `npm audit fix --force`

## ImageGen Asset

- Workspace path: `frontend/public/images/durian-orchard-hero.png`
- Mode: built-in ImageGen
- Use case: `photorealistic-natural`

Final prompt:

```text
Create a wide, photorealistic editorial landing-page hero of a healthy mature durian orchard
in Thailand after light rain. Show several realistic durian fruits, an orderly working orchard,
irrigation infrastructure, and a compact physically plausible agricultural weather station / IoT
sensor mast at right-center. Leave calmer negative space on the left for white Thai headline copy.
Use natural varied greens, early-morning light, real soil and foliage texture, and restrained color.
No people, text, logo, watermark, dashboard, oversized fruit, fantasy lighting, gradient, bokeh,
drone view, or staged advertising props.
```

## Verification Evidence

### Automated

- `npm.cmd run lint`
- `npm.cmd run typecheck`
- `npm.cmd run build`
- `npm.cmd audit --omit=dev`

### Browser observations

| Viewport | สิ่งที่ตรวจ |
| --- | --- |
| 360x800 | Mobile Hero, next-section hint, menu, register/login/status forms และ overflow |
| 768x900 | Navigation transformation, Hero height, รายการอุปกรณ์ และคู่มือเริ่มต้น |
| 1280x800 | Landing composition, image crop, desktop header และ Authentication split layout |
| 1600x900 | Max container, Hero crop, fixed type scale และ overflow |
| 1715x745/802 | Landing contact/Hero state, Auth state matrix, Reset Password, Profile และ Guide interaction |

Flows exercised:

- เปิด/ปิด mobile navigation
- กรอกและส่ง register form ด้วยข้อมูลจำลอง
- ตรวจ password requirements, matching และ terms checkbox
- กรอกและส่ง login form ด้วยข้อมูลจำลอง
- เปิด verify-email expired state
- ตรวจ registration pending state และ resend state
- ตรวจ login invalid, pending, suspended และ rate-limited state
- ตรวจ register duplicate, submitting และ success state
- ตรวจ registration pending, active และ rejected state
- ตรวจ forgot-password rate-limited และ verify-email loading state
- ตรวจ reset-password valid, expired, invalid, submitting และ success state
- ตรวจ Profile form success simulation
- ตรวจภาพ Hero/Logo โหลดสำเร็จ
- ตรวจ Hero ready state ใน browser และตรวจ implementation ของ loading/error fallback พร้อมช่องทางติดต่อทางการ
- ตรวจ browser console error

Observed corrections:

- ลดความสูง Hero เพื่อให้เห็นเนื้อหาของ section ถัดไปใน viewport แรก
- ปรับ mobile image crop และ overlay ให้เห็นบริบทสวนโดยข้อความยังอ่านชัด
- เปลี่ยน mobile menu close behavior เพื่อไม่ set state ภายใน React effect
- เพิ่ม relative media wrapper เพื่อแก้ Next Image warning ใน sticky Authentication panel
- อัปเดต Next.js เพื่อแก้ production dependency advisory
- ถอด mock dashboard และข้อมูลสวนตัวอย่างออกจาก Landing page โดยข้อมูลระดับสวนจะแสดงหลังเข้าสู่ระบบและตรวจสิทธิ์เท่านั้น
- เพิ่มรายการอุปกรณ์ที่รองรับตาม system contract ได้แก่ Weather Station, `SOIL_TH`, `SOIL_7_IN_1` และ Relay Controller 4 ช่อง
- เพิ่ม Quick Start บน Landing page และเมนูสำหรับส่วนอุปกรณ์และคู่มือ
- เพิ่มหน้า `/guide` แบบเอกสาร พร้อมสารบัญ 8 หัวข้อ ขั้นตอน Simulator/Hardware ข้อควรระวังรีเลย์ และ troubleshooting แบบเปิดอ่านได้
- เติม Authentication UI states ตาม screen contract และเพิ่ม Reset Password/Profile
- เพิ่ม Hero loading/error fallback และส่วนติดต่อที่ลิงก์ไปยังช่องทางทางการของมหาวิทยาลัย

## Remaining Gaps

- Authentication/Profile ยังเป็น UI simulation ไม่เชื่อม FastAPI, session, CSRF หรือ database
- ยังไม่มี dashboard route สำหรับผู้ใช้ที่เข้าสู่ระบบ
- ยังไม่มี email delivery หรือ token validation จริง
- ยังไม่มี automated component/E2E test suite; Phase 1A ใช้ lint/typecheck/build/audit และ browser flow verification ส่วน integration/E2E จะเพิ่มพร้อม backend vertical slice
- ยังไม่ได้ทดสอบกับผู้ใช้ภาคสนามหรืออ้างว่าเป็น WCAG compliant
- ช่องทางติดต่อเฉพาะโครงการยังไม่ได้กำหนด จึงใช้ลิงก์ช่องทางทางการของมหาวิทยาลัยโดยระบุขอบเขตชัดเจน
- Sensor/Relay simulator runtime จะเริ่มใน Phase 1D/1E
