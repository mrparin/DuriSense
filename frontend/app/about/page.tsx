import type { Metadata } from "next";
import { ArrowRight, Database, RadioTower, ShieldCheck, Sprout } from "lucide-react";
import Link from "next/link";
import { PublicShell } from "@/components/public-shell";

export const metadata: Metadata = {
  title: "เกี่ยวกับระบบ",
  description: "ที่มา แนวคิด และขอบเขตของระบบ DuriSense",
};

export default function AboutPage() {
  return (
    <PublicShell>
      <section className="page-hero page-hero--green">
        <div className="container page-hero__grid">
          <div>
            <p className="eyebrow eyebrow--light">เกี่ยวกับระบบ</p>
            <h1>DuriSense เชื่อมแปลง อุปกรณ์ และข้อมูลไว้ในบริบทเดียว</h1>
          </div>
          <p>
            ระบบถูกออกแบบให้เกษตรกรเริ่มจากการมองเห็นข้อมูลที่เชื่อถือได้
            ก่อนขยายไปสู่การแจ้งเตือน การบันทึกกิจกรรม และการควบคุมอุปกรณ์อย่างปลอดภัย
          </p>
        </div>
      </section>

      <section className="about-content">
        <div className="container about-content__grid">
          <aside>
            <p className="eyebrow">หลักคิด</p>
            <h2>ข้อมูลต้องบอกได้ว่ามาจากไหนและใหม่แค่ไหน</h2>
          </aside>
          <div className="prose">
            <p>
              DuriSense แยกโครงสร้างตั้งแต่บัญชี สวน แปลง Weather Station ไปจนถึง Soil Sensor
              ทุกค่าจึงเชื่อมกลับไปยังตำแหน่ง อุปกรณ์ เวลา หน่วย และสถานะคุณภาพได้
            </p>
            <p>
              ระบบระยะแรกใช้ข้อมูลจาก Sensor Simulator และ Relay Simulator เพื่อทดสอบทุกสถานะ
              ด้วย contract เดียวกับ ESP32 จริง เมื่อพร้อมเชื่อมภาคสนามจึงไม่ต้องสร้างช่องทางเฉพาะใหม่
            </p>
          </div>
        </div>
      </section>

      <section className="principles-section" aria-labelledby="principles-title">
        <div className="container">
          <header className="section-heading">
            <p className="eyebrow">หลักการของระบบ</p>
            <h2 id="principles-title">เรียบง่ายต่อผู้ใช้ และเข้มงวดกับข้อมูลเบื้องหลัง</h2>
          </header>
          <div className="principle-grid">
            <article><Sprout aria-hidden="true" /><h3>ตามโครงสร้างสวนจริง</h3><p>รองรับหลายสวน หลายแปลง หลายสถานี และประวัติการย้ายเซนเซอร์</p></article>
            <article><Database aria-hidden="true" /><h3>รักษาที่มาของข้อมูล</h3><p>แยกเวลาวัด เวลารับ ค่าดิบ ค่าประมวลผล หน่วย และคุณภาพข้อมูล</p></article>
            <article><ShieldCheck aria-hidden="true" /><h3>แยกสิทธิ์ทุกชั้น</h3><p>ผู้ใช้เห็นเฉพาะสวนและอุปกรณ์ที่ได้รับสิทธิ์ โดย backend ตรวจทุกคำขอ</p></article>
            <article><RadioTower aria-hidden="true" /><h3>พร้อมเชื่อมภาคสนาม</h3><p>MQTT/TLS, credential รายอุปกรณ์ และคำสั่งรีเลย์ที่รอ ACK ก่อนยืนยัน</p></article>
          </div>
        </div>
      </section>

      <section className="about-owner">
        <div className="container about-owner__grid">
          <div>
            <p className="eyebrow">ผู้พัฒนาระบบ</p>
            <h2>Parinya Jansengrat</h2>
            <p>มหาวิทยาลัยเทคโนโลยีราชมงคลธัญบุรี</p>
          </div>
          <Link className="button button--primary button--large" href="/register">
            สมัครใช้งาน DuriSense
            <ArrowRight aria-hidden="true" />
          </Link>
        </div>
      </section>
    </PublicShell>
  );
}
