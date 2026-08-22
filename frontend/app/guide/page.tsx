import type { Metadata } from "next";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Cable,
  CheckCircle2,
  CircleHelp,
  Database,
  Gauge,
  LockKeyhole,
  RadioTower,
  ShieldCheck,
  Sliders,
  Sprout,
  ToggleLeft,
  UserRoundCheck,
  WifiOff,
} from "lucide-react";
import Link from "next/link";
import { PublicShell } from "@/components/public-shell";

export const metadata: Metadata = {
  title: "คู่มือการใช้งาน",
  description: "คู่มือเริ่มต้นใช้งาน DuriSense ตั้งแต่บัญชีผู้ใช้ การตั้งค่าสวน การสอบเทียบเซนเซอร์ ไปจนถึงอุปกรณ์และรีเลย์",
};

const guideNavigation = [
  { href: "#before-start", label: "ก่อนเริ่มใช้งาน" },
  { href: "#account", label: "บัญชีและการเข้าสู่ระบบ" },
  { href: "#farm", label: "สร้างสวนและแปลง" },
  { href: "#devices", label: "เพิ่มอุปกรณ์" },
  { href: "#calibration", label: "การสอบเทียบเซนเซอร์ (Calibration)" },
  { href: "#connection", label: "Simulator และฮาร์ดแวร์" },
  { href: "#monitoring", label: "ติดตามข้อมูล" },
  { href: "#relay", label: "ควบคุมรีเลย์" },
  { href: "#troubleshooting", label: "แก้ปัญหาเบื้องต้น" },
];

const relayStates = [
  ["PENDING", "ระบบส่งคำสั่งแล้วและกำลังรอการตอบรับ"],
  ["ACKNOWLEDGED", "อุปกรณ์ตอบรับและรายงานสถานะที่ตรงกับคำสั่ง"],
  ["FAILED", "อุปกรณ์ปฏิเสธหรือไม่สามารถทำคำสั่งได้"],
  ["TIMEOUT / EXPIRED", "ไม่ได้รับคำตอบภายในเวลาที่กำหนด ห้ามสรุปว่ารีเลย์เปลี่ยนสถานะแล้ว"],
  ["STATE_MISMATCH", "สถานะที่อุปกรณ์รายงานกลับไม่ตรงกับคำสั่ง ต้องตรวจสอบหน้างาน"],
];

export default function GuidePage() {
  return (
    <PublicShell>
      <section className="guide-hero" aria-labelledby="guide-page-title">
        <div className="container guide-hero__grid">
          <div>
            <p className="eyebrow eyebrow--light">คู่มือการใช้งานระบบ</p>
            <h1 id="guide-page-title">เริ่มใช้งาน DuriSense อย่างเป็นขั้นตอน</h1>
            <p className="guide-hero__lead">
              ตั้งแต่การเปิดบัญชี จัดโครงสร้างสวน การสอบเทียบเซนเซอร์ดิน เชื่อมสถานี
              ไปจนถึงการอ่านสถานะข้อมูลและควบคุมรีเลย์อย่างตรวจสอบได้
            </p>
            <div className="guide-hero__actions">
              <Link className="button button--accent button--large" href="/register">
                สมัครสมาชิก
                <ArrowRight aria-hidden="true" />
              </Link>
              <Link className="button button--ghost-light button--large" href="/login">
                เข้าสู่ระบบ
              </Link>
            </div>
          </div>

          <div className="guide-hero__summary" aria-label="ขอบเขตของคู่มือ">
            <p><span>กลุ่มผู้ใช้งาน</span><strong>Farmer, ช่างเทคนิค และนักวิจัย</strong></p>
            <p><span>แหล่งข้อมูลระยะแรก</span><strong>Simulator พร้อมทางเชื่อมฮาร์ดแวร์จริง</strong></p>
            <p><span>ความเป็นส่วนตัว</span><strong>ข้อมูลสวนแสดงหลังเข้าสู่ระบบเท่านั้น</strong></p>
          </div>
        </div>
      </section>

      <section className="guide-docs" aria-label="เนื้อหาคู่มือ DuriSense">
        <div className="container guide-docs__layout">
          <aside className="guide-toc">
            <p className="guide-toc__title">สารบัญ</p>
            <nav aria-label="สารบัญคู่มือ">
              {guideNavigation.map((item, index) => (
                <a href={item.href} key={item.href}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  {item.label}
                </a>
              ))}
            </nav>
          </aside>

          <article className="guide-content">
            <section className="guide-chapter guide-chapter--first" id="before-start">
              <div className="guide-chapter__heading">
                <span className="guide-chapter__index">01</span>
                <div>
                  <p className="eyebrow">ก่อนเริ่มใช้งาน</p>
                  <h2>เตรียมบัญชี พื้นที่ และข้อมูลอุปกรณ์</h2>
                </div>
              </div>
              <p className="guide-chapter__lead">
                การเตรียมชื่อเรียกและโครงสร้างพื้นที่ให้ตรงกับหน้างาน ช่วยให้ค้นหาสถานี
                ย้ายเซนเซอร์ และตรวจสอบประวัติได้ถูกต้องในภายหลัง
              </p>
              <ul className="guide-checklist">
                <li><CheckCircle2 aria-hidden="true" /><span>อีเมลที่ใช้รับลิงก์ยืนยันบัญชี</span></li>
                <li><CheckCircle2 aria-hidden="true" /><span>ชื่อสวน ชื่อแปลงหรือโซน และเขตเวลาของสวน</span></li>
                <li><CheckCircle2 aria-hidden="true" /><span>ประเภทอุปกรณ์และตำแหน่งติดตั้งที่ตรวจสอบได้</span></li>
                <li><CheckCircle2 aria-hidden="true" /><span>ผู้รับผิดชอบการติดตั้งหรือทดสอบรีเลย์</span></li>
              </ul>
              <div className="guide-callout">
                <LockKeyhole aria-hidden="true" />
                <p><strong>รักษาข้อมูลอุปกรณ์เป็นความลับ</strong><span>Credential, certificate และ secret ต้องไม่ส่งผ่านแชตหรือบันทึกไว้ในชื่ออุปกรณ์</span></p>
              </div>
            </section>

            <section className="guide-chapter" id="account">
              <div className="guide-chapter__heading">
                <span className="guide-chapter__index">02</span>
                <div>
                  <p className="eyebrow">บัญชีผู้ใช้</p>
                  <h2>สมัคร ยืนยันบัญชี และเข้าสู่ระบบ</h2>
                </div>
              </div>
              <ol className="guide-instructions">
                <li><strong>เปิดหน้าสมัครสมาชิก</strong><span>กรอกชื่อ อีเมล รหัสผ่าน และยอมรับเงื่อนไขที่ระบบกำหนด</span></li>
                <li><strong>ตรวจสถานะการสมัคร</strong><span>บัญชีจะเปิดใช้ผ่านลิงก์ยืนยันอีเมล หรือการอนุมัติจากผู้ดูแลระบบ</span></li>
                <li><strong>เข้าสู่ระบบ</strong><span>เมื่อบัญชีพร้อมใช้งาน ให้เข้าสู่ระบบเพื่อเปิดพื้นที่จัดการสวนที่ได้รับสิทธิ์</span></li>
                <li><strong>กู้คืนเมื่อจำรหัสผ่านไม่ได้</strong><span>ใช้เมนูลืมรหัสผ่าน ระบบจะตอบกลับแบบไม่เปิดเผยว่าอีเมลใดมีบัญชีอยู่หรือไม่</span></li>
              </ol>
            </section>

            <section className="guide-chapter" id="farm">
              <div className="guide-chapter__heading">
                <span className="guide-chapter__index">03</span>
                <div>
                  <p className="eyebrow">โครงสร้างพื้นที่</p>
                  <h2>สร้างสวนและแปลงให้ตรงกับการติดตั้งจริง</h2>
                </div>
              </div>
              <div className="guide-topology" aria-label="ลำดับโครงสร้างข้อมูล">
                <span>สวน</span><ArrowRight aria-hidden="true" /><span>แปลง / โซน</span><ArrowRight aria-hidden="true" /><span>Weather Station</span><ArrowRight aria-hidden="true" /><span>Soil Sensor</span>
              </div>
              <ol className="guide-instructions">
                <li><strong>สร้างสวน</strong><span>ตั้งชื่อที่แยกจากสวนอื่นได้ชัดเจน และตรวจเขตเวลาให้ถูกต้อง</span></li>
                <li><strong>เพิ่มแปลงหรือโซน</strong><span>แบ่งพื้นที่ตามงานดูแลหรือตำแหน่งติดตั้งจริง ไม่ใช้ชื่อกว้างจนค้นหาสถานีได้ยาก</span></li>
                <li><strong>กำหนดสมาชิก</strong><span>เพิ่มเฉพาะผู้ที่ต้องดูหรือจัดการข้อมูลของสวนนั้น และตรวจบทบาทก่อนบันทึก</span></li>
              </ol>
            </section>

            <section className="guide-chapter" id="devices">
              <div className="guide-chapter__heading">
                <span className="guide-chapter__index">04</span>
                <div>
                  <p className="eyebrow">จัดการอุปกรณ์</p>
                  <h2>เพิ่มสถานี เซนเซอร์ และบันทึกตำแหน่งติดตั้ง</h2>
                </div>
              </div>
              <div className="guide-device-list">
                <article><RadioTower aria-hidden="true" /><div><h3>Weather Station / Gateway</h3><p>ลงทะเบียนสถานีในแปลงที่ติดตั้ง กำหนดชื่อ ตำแหน่ง และข้อมูลประกอบที่ใช้ตรวจหน้างาน</p></div></article>
                <article><Sprout aria-hidden="true" /><div><h3>SOIL_TH</h3><p>เลือกสำหรับอุณหภูมิและความชื้นดิน แล้ว assign ไปยัง Weather Station ที่เชื่อมต่ออยู่</p></div></article>
                <article><Gauge aria-hidden="true" /><div><h3>SOIL_7_IN_1</h3><p>รองรับอุณหภูมิ ความชื้น EC pH และ N P K โดย Sensor ID ต้องคงเดิมเมื่อย้ายสถานี</p></div></article>
                <article><ToggleLeft aria-hidden="true" /><div><h3>Relay Controller 4 ช่อง</h3><p>ตั้งชื่อการใช้งานแต่ละช่องได้ แต่ไม่เปลี่ยน hardware mapping จากหน้าจอผู้ใช้</p></div></article>
              </div>
              <div className="guide-callout guide-callout--neutral">
                <Database aria-hidden="true" />
                <p><strong>ย้ายหรือยกเลิกอุปกรณ์โดยรักษาประวัติ</strong><span>ใช้การ reassign หรือ decommission แทนการสร้าง Sensor ID ใหม่หรือลบข้อมูลย้อนหลัง</span></p>
              </div>
            </section>

            <section className="guide-chapter" id="calibration">
              <div className="guide-chapter__heading">
                <span className="guide-chapter__index">05</span>
                <div>
                  <p className="eyebrow">การสอบเทียบ</p>
                  <h2>วิธีการและสูตรสอบเทียบเซนเซอร์ดิน (Sensor Calibration)</h2>
                </div>
              </div>
              <p className="guide-chapter__lead">
                ระบบรองรับการชดเชยค่าความคลาดเคลื่อนของเซนเซอร์บน Cloud (Cloud-Side Calibration)
                โดยที่ฮาร์ดแวร์ส่งค่าดิบขึ้นมา แล้วระบบจะคำนวณปรับค่าที่ถูกต้องตามสูตรที่กำหนด ช่วยให้ไม่ต้องแก้ไข Firmware ทุกครั้งที่เปลี่ยนรอบสอบเทียบ
              </p>

              <div className="connection-paths" style={{ marginBottom: "var(--space-6)" }}>
                <article>
                  <span style={{ color: "var(--brand-700)", fontWeight: 800 }}>วิธีที่ 1 (นิยมมากที่สุด)</span>
                  <h3>การสอบเทียบแบบ 1 จุด (1-Point / Offset Only)</h3>
                  <p>เหมาะสำหรับการตรวจวัดกับน้ำยามาตรฐาน 1 ค่า (เช่น น้ำยา pH 7.00 หรือ EC 1413 µS/cm) เพื่อปรับแก้ค่าเลื่อน (Zero Shift):</p>
                  <ul style={{ paddingLeft: "var(--space-4)", margin: "var(--space-2) 0", fontSize: 14, color: "var(--ink-700)" }}>
                    <li><strong>สูตร:</strong> <code>y = x + b</code> (หรือ Linear โดยให้ Scale a = 1.0)</li>
                    <li><strong>การคำนวณ Offset (b):</strong> <code>b = ค่าน้ำยาจริง - ค่าที่เซนเซอร์อ่านได้</code></li>
                    <li><strong>ตัวอย่าง:</strong> น้ำยา pH 7.00 แต่อ่านได้ 6.80 &rarr; ตั้งค่า <code>Offset = +0.20</code></li>
                  </ul>
                </article>

                <article>
                  <span style={{ color: "var(--brand-700)", fontWeight: 800 }}>วิธีที่ 2 (ความแม่นยำสูงสุด)</span>
                  <h3>การสอบเทียบแบบ 2 จุด (2-Point / Linear y = ax + b)</h3>
                  <p>เหมาะสำหรับการสอบเทียบโพรบวัด pH หรือ EC ตลอดช่วงการวัด เช่น ทดสอบกับน้ำยามาตรฐาน 2 จุด (pH 4.01 และ pH 7.00):</p>
                  <ul style={{ paddingLeft: "var(--space-4)", margin: "var(--space-2) 0", fontSize: 14, color: "var(--ink-700)" }}>
                    <li><strong>Scale factor (a):</strong> <code>(ค่าน้ำยา2 - ค่าน้ำยา1) / (ค่าอ่าน2 - ค่าอ่าน1)</code></li>
                    <li><strong>Offset value (b):</strong> <code>ค่าน้ำยา1 - (a × ค่าอ่าน1)</code></li>
                    <li><strong>การชดเชยอุณหภูมิ:</strong> เปิดใช้งานหากเซนเซอร์มีหัววัดอุณหภูมิในตัว เพื่อปรับเทียบที่ 25°C</li>
                  </ul>
                </article>
              </div>

              <div className="guide-callout">
                <Sliders aria-hidden="true" />
                <p><strong>บันทึกประวัติทุกครั้ง</strong><span>ระบุ Lot หรือวันที่หมดอายุของน้ำยามาตรฐานในช่องหมายเหตุ เพื่อใช้เป็นหลักฐานงานวิจัยและความแม่นยำย้อนหลัง</span></p>
              </div>
            </section>

            <section className="guide-chapter" id="connection">
              <div className="guide-chapter__heading">
                <span className="guide-chapter__index">06</span>
                <div>
                  <p className="eyebrow">แหล่งข้อมูล</p>
                  <h2>เลือก Simulator หรือเชื่อมฮาร์ดแวร์จริง</h2>
                </div>
              </div>
              <div className="connection-paths">
                <article>
                  <span>เริ่มต้นและทดสอบ</span>
                  <h3>Sensor / Relay Simulator</h3>
                  <p>ใช้ทดสอบข้อมูลปกติ ข้อมูลขาด อุปกรณ์ offline และผลตอบรับรีเลย์ โดยไม่สั่งโหลดไฟฟ้าจริง</p>
                </article>
                <article>
                  <span>ติดตั้งภาคสนาม</span>
                  <h3>ฮาร์ดแวร์จริง</h3>
                  <p>เชื่อมผ่าน MQTT/TLS ด้วย credential รายสถานี หลังผ่าน schema, reconnect, fail-safe และ electrical field test</p>
                </article>
              </div>
              <ul className="guide-checklist guide-checklist--compact">
                <li><ShieldCheck aria-hidden="true" /><span>ใช้ MQTT/TLS ที่พอร์ต 8883 และปิด anonymous access</span></li>
                <li><ShieldCheck aria-hidden="true" /><span>Station ID ใน registry, topic และ payload ต้องตรงกัน</span></li>
                <li><ShieldCheck aria-hidden="true" /><span>ตรวจเวลา หน่วย และ Sensor assignment ก่อนรับข้อมูล</span></li>
              </ul>
            </section>

            <section className="guide-chapter" id="monitoring">
              <div className="guide-chapter__heading">
                <span className="guide-chapter__index">07</span>
                <div>
                  <p className="eyebrow">ติดตามข้อมูล</p>
                  <h2>อ่านค่าพร้อมเวลา คุณภาพ และสถานะอุปกรณ์</h2>
                </div>
              </div>
              <p className="guide-chapter__lead">
                เลือกสวน แปลง สถานี และเซนเซอร์ก่อนอ่านค่า ทุกค่าควรพิจารณาร่วมกับหน่วย
                เวลาที่วัด เวลาที่ระบบได้รับ และสถานะคุณภาพ
              </p>
              <dl className="guide-status-list">
                <div><dt>กำลังโหลด</dt><dd>ระบบกำลังขอข้อมูล หลีกเลี่ยงการสรุปจากพื้นที่ว่างชั่วคราว</dd></div>
                <div><dt>ไม่มีข้อมูล</dt><dd>ยังไม่เคยได้รับค่าจากอุปกรณ์และตัวกรองที่เลือก</dd></div>
                <div><dt>ข้อมูลเก่า</dt><dd>ค่าล่าสุดเกินช่วงเวลาที่คาดไว้ ควรตรวจสถานี เครือข่าย และ sampling interval</dd></div>
                <div><dt>อุปกรณ์ Offline</dt><dd>ไม่ได้รับสถานะตามเวลาที่กำหนด ให้ตรวจไฟเลี้ยงและการเชื่อมต่อภาคสนาม</dd></div>
                <div><dt>เกิดข้อผิดพลาด</dt><dd>ระบบอ่านหรือประมวลผลข้อมูลไม่สำเร็จ ลองใหม่และแจ้งผู้ดูแลหากเกิดซ้ำ</dd></div>
              </dl>
            </section>

            <section className="guide-chapter" id="relay">
              <div className="guide-chapter__heading">
                <span className="guide-chapter__index">08</span>
                <div>
                  <p className="eyebrow">ควบคุมอุปกรณ์</p>
                  <h2>สั่งรีเลย์โดยรอผลตอบรับจากอุปกรณ์</h2>
                </div>
              </div>
              <div className="guide-callout guide-callout--warning">
                <AlertTriangle aria-hidden="true" />
                <p><strong>เริ่มทดสอบด้วย Relay Simulator</strong><span>ห้ามต่อโหลดกำลังสูงก่อนผ่านการตรวจหน้างาน contactor, interlock, manual override และ fail-safe โดยผู้รับผิดชอบ</span></p>
              </div>
              <ol className="guide-instructions">
                <li><strong>ตรวจชื่อช่องและสถานะล่าสุด</strong><span>ยืนยันว่ากำลังสั่งอุปกรณ์ในสวน แปลง สถานี และ Relay channel ที่ถูกต้อง</span></li>
                <li><strong>ยืนยันคำสั่ง</strong><span>สำหรับ critical load ระบบต้องแสดงผลกระทบก่อนส่งคำสั่งเปิดหรือปิด</span></li>
                <li><strong>รอ ACK และ reported state</strong><span>อย่ากดซ้ำระหว่างสถานะ PENDING และอย่าถือว่าคำสั่งสำเร็จก่อนอุปกรณ์ตอบกลับ</span></li>
              </ol>
              <dl className="relay-state-list">
                {relayStates.map(([state, meaning]) => <div key={state}><dt>{state}</dt><dd>{meaning}</dd></div>)}
              </dl>
            </section>

            <section className="guide-chapter" id="troubleshooting">
              <div className="guide-chapter__heading">
                <span className="guide-chapter__index">09</span>
                <div>
                  <p className="eyebrow">แก้ปัญหาเบื้องต้น</p>
                  <h2>ตรวจจากบัญชี ไปจนถึงอุปกรณ์ภาคสนาม</h2>
                </div>
              </div>
              <div className="troubleshooting-list">
                <details>
                  <summary><UserRoundCheck aria-hidden="true" />เข้าสู่ระบบได้ แต่ไม่เห็นสวน</summary>
                  <p>ตรวจว่าบัญชีได้รับอนุมัติแล้วและถูกเพิ่มเป็นสมาชิกของสวนนั้น หากเพิ่งเปลี่ยนสิทธิ์ให้ออกจากระบบแล้วเข้าสู่ระบบใหม่</p>
                </details>
                <details>
                  <summary><WifiOff aria-hidden="true" />สถานีแสดง Offline หรือข้อมูลไม่อัปเดต</summary>
                  <p>ตรวจไฟเลี้ยง เครือข่าย เวลาในอุปกรณ์ credential และ Station ID จากนั้นตรวจว่าอุปกรณ์ publish ไปยัง topic ที่ได้รับอนุญาต</p>
                </details>
                <details>
                  <summary><Cable aria-hidden="true" />Soil Sensor ไม่มีข้อมูล</summary>
                  <p>ตรวจ Sensor ID, ชนิดเซนเซอร์, สายหรือ Modbus address และ assignment ว่าผูกกับ Weather Station ในช่วงเวลาปัจจุบัน</p>
                </details>
                <details>
                  <summary><CircleHelp aria-hidden="true" />คำสั่งรีเลย์ Timeout หรือ State mismatch</summary>
                  <p>หยุดส่งคำสั่งซ้ำ ตรวจสถานะอุปกรณ์และโหลดที่หน้างาน แล้วให้ผู้รับผิดชอบยืนยัน reported state ก่อนดำเนินการต่อ</p>
                </details>
              </div>
            </section>

            <div className="guide-end">
              <Activity aria-hidden="true" />
              <div><strong>พร้อมเริ่มต้นใช้งาน</strong><span>สร้างบัญชีเพื่อเข้าสู่ขั้นตอนตั้งค่าสวนและอุปกรณ์ในพื้นที่ส่วนตัว</span></div>
              <Link className="button button--primary" href="/register">สมัครสมาชิก<ArrowRight aria-hidden="true" /></Link>
            </div>
          </article>
        </div>
      </section>
    </PublicShell>
  );
}
