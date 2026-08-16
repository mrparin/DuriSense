import {
  Activity,
  ArrowRight,
  BellRing,
  BookOpenCheck,
  Cable,
  ChartNoAxesCombined,
  CheckCircle2,
  Cpu,
  Database,
  ExternalLink,
  LogIn,
  LockKeyhole,
  MapPinned,
  RadioTower,
  Settings2,
  ShieldCheck,
  Smartphone,
  Sprout,
  ThermometerSun,
  ToggleLeft,
  UserPlus,
  Wifi,
} from "lucide-react";
import Link from "next/link";
import { HeroMedia } from "@/components/landing/hero-media";
import { PublicShell } from "@/components/public-shell";

const capabilities = [
  {
    number: "01",
    title: "เห็นสภาพแปลงจากข้อมูลล่าสุด",
    description:
      "ติดตามอุณหภูมิ ความชื้นอากาศ ความชื้นดิน ลม แสง และธาตุอาหาร พร้อมหน่วย คุณภาพ และเวลาอัปเดต",
    icon: ChartNoAxesCombined,
  },
  {
    number: "02",
    title: "รู้เมื่อข้อมูลหรืออุปกรณ์ผิดปกติ",
    description:
      "แยกสถานะออนไลน์ ข้อมูลเก่า ข้อมูลขาด และค่าที่ควรตรวจสอบ เพื่อให้เริ่มแก้ปัญหาจากจุดที่สำคัญก่อน",
    icon: BellRing,
  },
  {
    number: "03",
    title: "จัดการสถานีและเซนเซอร์ตามแปลงจริง",
    description:
      "รองรับหลายสวน หลายแปลง Weather Station และ Soil Sensor หลายตัว พร้อมประวัติการย้ายอุปกรณ์",
    icon: RadioTower,
  },
  {
    number: "04",
    title: "เตรียมควบคุมอุปกรณ์อย่างตรวจสอบได้",
    description:
      "คำสั่งรีเลย์รอการตอบรับจากอุปกรณ์ก่อนยืนยันผล และเก็บประวัติการสั่งงานทุกครั้ง",
    icon: ShieldCheck,
  },
];

const flow = [
  {
    step: "รับข้อมูล",
    detail: "Weather Station และ Soil Sensor ส่งข้อมูลผ่าน MQTT/TLS",
    icon: Wifi,
  },
  {
    step: "ตรวจและจัดเก็บ",
    detail: "DuriSense ตรวจตัวตน รูปแบบ หน่วย เวลา และข้อมูลซ้ำก่อนบันทึก",
    icon: Database,
  },
  {
    step: "แสดงผลเพื่อดำเนินการ",
    detail: "Farmer เห็นสถานะ กราฟ การแจ้งเตือน และอุปกรณ์เฉพาะสวนที่ได้รับสิทธิ์",
    icon: Smartphone,
  },
];

const supportedDevices = [
  {
    number: "01",
    category: "สถานีหลัก",
    title: "Weather Station / Gateway",
    description:
      "รวบรวมข้อมูลสภาพอากาศและส่งข้อมูลเข้าสู่ DuriSense ผ่านการเชื่อมต่อที่ยืนยันตัวตนอุปกรณ์",
    readings: ["อุณหภูมิอากาศ", "ความชื้นสัมพัทธ์", "ลม", "แสง"],
    icon: RadioTower,
  },
  {
    number: "02",
    category: "เซนเซอร์ดิน",
    title: "SOIL_TH",
    description:
      "เซนเซอร์สำหรับติดตามสองค่าพื้นฐานของดิน เหมาะกับการเฝ้าดูสภาวะในแต่ละจุดของแปลง",
    readings: ["อุณหภูมิดิน", "ความชื้นดิน"],
    icon: ThermometerSun,
  },
  {
    number: "03",
    category: "เซนเซอร์ดิน",
    title: "SOIL_7_IN_1",
    description:
      "รองรับข้อมูลดินแบบหลายค่า โดยผูก Sensor ID กับสถานีและเก็บประวัติการย้ายตำแหน่ง",
    readings: ["อุณหภูมิ", "ความชื้น", "EC", "pH", "N", "P", "K"],
    icon: Sprout,
  },
  {
    number: "04",
    category: "อุปกรณ์ควบคุม",
    title: "Relay Controller 4 ช่อง",
    description:
      "ส่งคำสั่งเปิดหรือปิดและรอ ACK พร้อม reported state ก่อนยืนยันผลบนหน้าจอ",
    readings: ["Relay 1-4", "Command ACK", "สถานะล่าสุด"],
    icon: ToggleLeft,
  },
];

const quickStart = [
  {
    step: "สมัครสมาชิก",
    detail: "สร้างบัญชีด้วยอีเมลและข้อมูลที่จำเป็นสำหรับการขอใช้งานระบบ",
    icon: UserPlus,
  },
  {
    step: "ยืนยันบัญชีและเข้าสู่ระบบ",
    detail: "เปิดใช้งานบัญชีผ่านอีเมลหรือรอผู้ดูแลระบบอนุมัติก่อนเข้าสู่พื้นที่ผู้ใช้งาน",
    icon: LogIn,
  },
  {
    step: "สร้างสวนและแปลง",
    detail: "กำหนดโครงสร้างพื้นที่เพื่อใช้เป็นขอบเขตของสถานี เซนเซอร์ และสมาชิกในสวน",
    icon: MapPinned,
  },
  {
    step: "เพิ่มและเชื่อมอุปกรณ์",
    detail: "ลงทะเบียน Weather Station เพิ่ม Soil Sensor และกำหนด Sensor ให้กับสถานีที่ติดตั้งจริง",
    icon: Settings2,
  },
  {
    step: "ติดตามและดำเนินการ",
    detail: "ตรวจค่าล่าสุด กราฟ สถานะอุปกรณ์ การแจ้งเตือน และรีเลย์ตามสิทธิ์ของบัญชี",
    icon: Activity,
  },
];

export default function HomePage() {
  return (
    <PublicShell>
      <section className="hero" aria-labelledby="hero-title">
        <HeroMedia />
        <div className="hero__overlay" aria-hidden="true" />
        <div className="container hero__content">
          <div className="hero__copy">
            <p className="eyebrow eyebrow--light">ระบบบริการจัดการแปลงทุเรียนอัจฉริยะ</p>
            <h1 id="hero-title">DuriSense</h1>
            <p className="hero__lead">
              มองเห็นสภาพแปลงจากข้อมูลอากาศ ดิน และอุปกรณ์ เพื่อวางแผนดูแลสวนได้ชัดเจนขึ้น
              บนหน้าจอที่ออกแบบสำหรับการใช้งานภาคสนาม
            </p>
            <div className="hero__actions">
              <Link className="button button--accent button--large" href="/register">
                เริ่มต้นใช้งาน
                <ArrowRight aria-hidden="true" />
              </Link>
              <Link className="button button--ghost-light button--large" href="/login">
                เข้าสู่ระบบ
              </Link>
            </div>
          </div>
        </div>
        <div className="hero__facts" aria-label="ข้อมูลสำคัญของระบบ">
          <div className="container hero__facts-inner">
            <span><CheckCircle2 aria-hidden="true" />ภาษาไทยและรองรับมือถือ</span>
            <span><Cpu aria-hidden="true" />เริ่มด้วยอุปกรณ์จำลอง</span>
            <span><Wifi aria-hidden="true" />พร้อมเชื่อมฮาร์ดแวร์ผ่าน MQTT/TLS</span>
          </div>
        </div>
      </section>

      <section className="intro-band" aria-labelledby="intro-title">
        <div className="container intro-band__grid">
          <div>
            <p className="eyebrow">ดูแลสวนจากสิ่งที่กำลังเกิดขึ้นจริง</p>
            <h2 id="intro-title">ข้อมูลที่อ่านง่าย<br />และพาไปสู่การลงมือทำ</h2>
          </div>
          <div className="intro-band__copy">
            <p>
              DuriSense เชื่อมโครงสร้างสวน แปลง สถานีตรวจอากาศ และเซนเซอร์ดินเข้าด้วยกัน
              เพื่อให้ผู้ดูแลสวนเห็นทั้งค่าปัจจุบัน ประวัติ และสถานะอุปกรณ์ในบริบทเดียว
            </p>
            <Link className="text-link" href="/about">
              รู้จักโครงการ DuriSense
              <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <section className="capabilities-section" id="capabilities" aria-labelledby="capabilities-title">
        <div className="container">
          <header className="section-heading section-heading--split">
            <div>
              <p className="eyebrow">ความสามารถหลัก</p>
              <h2 id="capabilities-title">ออกแบบตามงานของคนดูแลแปลง</h2>
            </div>
            <p>เริ่มจากการติดตามที่เชื่อถือได้ และเตรียมเส้นทางสู่การควบคุมอุปกรณ์อย่างปลอดภัย</p>
          </header>

          <div className="capability-list">
            {capabilities.map((item) => {
              const Icon = item.icon;
              return (
                <article className="capability-row" key={item.number}>
                  <span className="capability-row__number">{item.number}</span>
                  <Icon className="capability-row__icon" aria-hidden="true" />
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                  <ArrowRight className="capability-row__arrow" aria-hidden="true" />
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="devices-section" id="devices" aria-labelledby="devices-title">
        <div className="container devices-section__layout">
          <header className="devices-section__heading">
            <p className="eyebrow">อุปกรณ์ที่รองรับ</p>
            <h2 id="devices-title">เชื่อมสถานีและเซนเซอร์ตามโครงสร้างของแปลง</h2>
            <p>
              ระยะแรกสามารถทดสอบระบบด้วย Sensor Simulator และ Relay Simulator
              ก่อนใช้ contract เดียวกันกับฮาร์ดแวร์จริง
            </p>
          </header>

          <div className="device-list">
            {supportedDevices.map((device) => {
              const Icon = device.icon;
              return (
                <article className="device-item" key={device.number}>
                  <span className="device-item__number">{device.number}</span>
                  <Icon className="device-item__icon" aria-hidden="true" />
                  <div className="device-item__content">
                    <p className="device-item__category">{device.category}</p>
                    <h3>{device.title}</h3>
                    <p>{device.description}</p>
                    <div className="device-item__readings" aria-label={`ข้อมูลที่รองรับโดย ${device.title}`}>
                      {device.readings.map((reading) => <span key={reading}>{reading}</span>)}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <div className="container device-connection">
          <div className="device-connection__title">
            <Cable aria-hidden="true" />
            <div>
              <span>มาตรฐานการเชื่อมต่อ</span>
              <strong>MQTT/TLS</strong>
            </div>
          </div>
          <p>ใช้ credential แยกรายอุปกรณ์และจำกัด topic ตามสถานี</p>
          <p><ShieldCheck aria-hidden="true" />Simulator และฮาร์ดแวร์จริงใช้รูปแบบข้อมูลเดียวกัน</p>
        </div>
      </section>

      <section className="flow-section" aria-labelledby="flow-title">
        <div className="container">
          <header className="section-heading section-heading--centered">
            <p className="eyebrow">จากเซนเซอร์ถึงหน้าจอ</p>
            <h2 id="flow-title">ข้อมูลผ่านการตรวจสอบก่อนถึงผู้ใช้งาน</h2>
          </header>
          <ol className="flow-list">
            {flow.map((item, index) => {
              const Icon = item.icon;
              return (
                <li key={item.step}>
                  <div className="flow-list__index">{String(index + 1).padStart(2, "0")}</div>
                  <Icon aria-hidden="true" />
                  <h3>{item.step}</h3>
                  <p>{item.detail}</p>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <section className="guide-section" id="guide" aria-labelledby="guide-title">
        <div className="container guide-section__layout">
          <header className="guide-section__heading">
            <BookOpenCheck aria-hidden="true" />
            <p className="eyebrow">คู่มือเริ่มต้นใช้งาน</p>
            <h2 id="guide-title">เริ่มจากบัญชีผู้ใช้ ไปจนถึงการติดตามแปลง</h2>
            <p>
              ลำดับนี้เป็นภาพรวมสำหรับเริ่มใช้งาน DuriSense
              โดยรายละเอียดของสวนและอุปกรณ์จะแสดงหลังเข้าสู่ระบบเท่านั้น
            </p>
            <Link className="text-link" href="/guide">
              อ่านคู่มือฉบับละเอียด
              <ArrowRight aria-hidden="true" />
            </Link>
          </header>

          <ol className="quick-start-list">
            {quickStart.map((item, index) => {
              const Icon = item.icon;
              return (
                <li key={item.step}>
                  <span className="quick-start-list__number">{String(index + 1).padStart(2, "0")}</span>
                  <Icon aria-hidden="true" />
                  <div>
                    <h3>{item.step}</h3>
                    <p>{item.detail}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="container public-data-note">
          <LockKeyhole aria-hidden="true" />
          <div>
            <strong>ข้อมูลส่วนตัวของสวนอยู่หลังการเข้าสู่ระบบ</strong>
            <span>ชื่อสวน ข้อมูลแปลง ค่าเซนเซอร์ สถานะอุปกรณ์ และประวัติคำสั่งไม่แสดงในพื้นที่สาธารณะ</span>
          </div>
          <Link className="text-link" href="/login">
            เข้าสู่ระบบ
            <ArrowRight aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section className="project-section" aria-labelledby="project-title">
        <div className="container project-section__grid">
          <div className="project-section__mark" aria-hidden="true">DS</div>
          <div>
            <p className="eyebrow">โครงการเพื่อการจัดการสวนและงานบริการวิชาการ</p>
            <h2 id="project-title">DuriSense พัฒนาเพื่อเชื่อมข้อมูลภาคสนามกับการตัดสินใจที่ตรวจสอบได้</h2>
          </div>
          <div className="project-section__meta">
            <p><span>ออกแบบระบบโดย</span><strong>Parinya Jansengrat</strong></p>
            <p><span>หน่วยงาน</span><strong>มหาวิทยาลัยเทคโนโลยีราชมงคลธัญบุรี</strong></p>
          </div>
        </div>
      </section>

      <section className="contact-section" id="contact" aria-labelledby="contact-title">
        <div className="container contact-section__grid">
          <div>
            <p className="eyebrow">ติดต่อและหน่วยงาน</p>
            <h2 id="contact-title">ข้อมูลโครงการและช่องทางติดต่อทางการ</h2>
            <p>
              ช่องทางติดต่อเฉพาะของ DuriSense อยู่ระหว่างกำหนด
              โดยสามารถตรวจข้อมูลหน่วยงานและช่องทางส่วนกลางของมหาวิทยาลัยได้จากเว็บไซต์ทางการ
            </p>
          </div>
          <div className="contact-links">
            <a href="https://www.rmutt.ac.th/contact/" target="_blank" rel="noreferrer">
              <span>มหาวิทยาลัยเทคโนโลยีราชมงคลธัญบุรี</span>
              <strong>หน้าติดต่อทางการ</strong>
              <ExternalLink aria-hidden="true" />
            </a>
            <Link href="/about">
              <span>ผู้พัฒนาและแนวคิดโครงการ</span>
              <strong>เกี่ยวกับ DuriSense</strong>
              <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <section className="cta-section" aria-labelledby="cta-title">
        <div className="container cta-section__inner">
          <div>
            <p className="eyebrow eyebrow--light">เริ่มต้นกับ DuriSense</p>
            <h2 id="cta-title">เตรียมพื้นที่จัดการแปลงของคุณ</h2>
          </div>
          <div className="cta-section__actions">
            <Link className="button button--accent button--large" href="/register">
              สมัครสมาชิก
              <ArrowRight aria-hidden="true" />
            </Link>
            <Link className="button button--ghost-light button--large" href="/login">
              เข้าสู่ระบบ
            </Link>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
