# API และ Screen Contract

## API Conventions

- Base path: `/api/v1`
- JSON ใช้ `snake_case`; เวลาเป็น ISO 8601 พร้อม offset ใน request และ UTC ใน storage
- List endpoint มี cursor/page, filter และ sort ตาม resource
- Error กลางประกอบด้วย `code`, `message`, `field_errors`, `request_id`
- ทุก mutation ต้องมี audit/correlation ID
- ทุก endpoint ตรวจ authenticated user, role และ resource scope ที่ backend

## Endpoint Groups

| Group | ตัวอย่าง path | Permission |
| --- | --- | --- |
| Public/Auth | `/auth/register`, `/auth/login`, `/auth/verify-email`, `/auth/registration-status` | Public/Owner |
| Session | `/auth/logout`, `/auth/sessions`, `/auth/password/*` | Authenticated |
| Profile | `/users/me` | Authenticated owner |
| Farms | `/farms`, `/farms/{farm_id}`, `/farms/{farm_id}/memberships` | Farm member/manager |
| Plots | `/farms/{farm_id}/plots`, `/plots/{plot_id}` | Farm scoped |
| Stations | `/weather-stations`, `/weather-stations/{station_id}` | Farm manager |
| Sensors | `/soil-sensors`, `/sensor-assignments`, `/calibrations` | Farm manager/technician scope |
| Telemetry | `/telemetry/latest`, `/telemetry/series`, `/telemetry/export` | Farm member |
| Relays | `/devices/{device_id}/relays` | Farm member/control permission |
| Commands | `/devices/{device_id}/relays/{channel}/commands` | Control permission |
| Alerts | `/alerts`, `/alert-rules`, `/notifications` | Farm member/manager |
| Activities | `/activities`, `/irrigation-events` | Farm member |
| Admin | `/admin/users`, `/admin/farms`, `/admin/devices`, `/admin/audit-logs` | Admin |
| Operations | `/health`, `/ready`, `/stream` | Policy-specific |

## Core Command Contract

`POST /api/v1/devices/{device_id}/relays/{channel}/commands`

Request:

```json
{
  "desired_state": "ON",
  "confirmation_token": "required-when-critical",
  "idempotency_key": "browser-generated-uuid"
}
```

Response `202 Accepted`:

```json
{
  "command_id": "cmd_01JXYZ123",
  "state": "PENDING",
  "desired_state": "ON",
  "reported_state": "OFF",
  "expires_at": "2026-08-07T07:30:15Z"
}
```

API ไม่ตอบ `ACKNOWLEDGED` จนได้รับ ACK/reported state จากอุปกรณ์

## Screen Inventory

### Public

| Route | หน้าที่หลัก | สถานะสำคัญ |
| --- | --- | --- |
| `/` | Landing page ของ DuriSense | default, image loading/error |
| `/about` | ที่มา เป้าหมาย และผู้พัฒนาระบบ | default |
| `/login` | เข้าสู่ระบบ | invalid, pending, suspended, rate-limited |
| `/register` | สมัครสมาชิก | validation, submitting, duplicate email, success |
| `/verify-email` | ใช้ token เปิดบัญชี | loading, success, expired, used, invalid |
| `/registration-status` | ติดตามสถานะและส่งลิงก์ใหม่ | pending, active, rejected |
| `/forgot-password` | ขอ reset password | generic success, rate-limited |

### Farmer Workspace

| Route | หน้าที่หลัก | จุดเด่น |
| --- | --- | --- |
| `/dashboard` | ภาพรวมสวนและสิ่งที่ต้องดำเนินการ | selector, latest data, alerts, device health |
| `/farms` | รายการและจัดการสวน | membership-aware list |
| `/farms/{farm_id}` | ภาพรวมสวน | plot status และ recent activity |
| `/farms/{farm_id}/plots/{plot_id}` | รายละเอียดแปลง | stations, sensors, latest readings |
| `/devices` | จัดการอุปกรณ์ | add, edit, decommission |
| `/devices/{device_id}` | สุขภาพและรายละเอียดอุปกรณ์ | last seen, firmware, assignment |
| `/devices/{device_id}/relays` | ตั้งชื่อและควบคุมรีเลย์ | ACK, timeout, critical confirmation |
| `/charts` | สำรวจและเปรียบเทียบข้อมูล | limited series, range, quality |
| `/alerts` | รับทราบและแก้ไขเหตุการณ์ | open, acknowledged, resolved |
| `/activities` | บันทึกกิจกรรมสวน | create/edit/history |
| `/reports` | รายงานและ export | queued, ready, failed |
| `/settings/profile` | โปรไฟล์และความปลอดภัย | save, validation, session management |

### Admin Workspace

| Route | หน้าที่หลัก |
| --- | --- |
| `/admin/overview` | สรุปบัญชีรออนุมัติ อุปกรณ์ offline และ data gap |
| `/admin/users/pending` | อนุมัติ/ปฏิเสธผู้สมัครพร้อมเหตุผล |
| `/admin/users` | จัดการ role, status และ reset workflow |
| `/admin/farms` | ตรวจโครงสร้าง tenant/farm membership |
| `/admin/devices` | ตรวจ credential lifecycle, status และ firmware |
| `/admin/data-quality` | quarantine, gap และ validation failure |
| `/admin/audit-logs` | ค้นเหตุการณ์ตาม actor/resource/time |

## Navigation Rules

- Visitor เห็น หน้าหลัก, เกี่ยวกับระบบ, เข้าสู่ระบบ และสมัครสมาชิก
- Farmer ใช้ mobile bottom navigation สำหรับ Dashboard, แปลง, แจ้งเตือน และเมนูเพิ่มเติม
- Desktop ใช้ sidebar ที่ย่อได้และมี farm context คงที่
- Admin แยก navigation context ชัดเจนและไม่ปะปนกับคำสั่งควบคุม Farmer
- Route guard ช่วย UX เท่านั้น; FastAPI ยังคงเป็นผู้บังคับสิทธิ์

