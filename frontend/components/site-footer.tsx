import { ExternalLink, MapPin } from "lucide-react";
import Link from "next/link";
import { BrandLogo } from "./brand-logo";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container site-footer__grid">
        <div className="site-footer__brand">
          <BrandLogo />
          <p>ระบบบริการจัดการแปลงทุเรียนอัจฉริยะสำหรับการติดตามและตัดสินใจจากข้อมูลภาคสนาม</p>
        </div>

        <div>
          <h2>เมนู</h2>
          <nav className="site-footer__links" aria-label="เมนูส่วนท้าย">
            <Link href="/">หน้าหลัก</Link>
            <Link href="/#devices">อุปกรณ์ที่รองรับ</Link>
            <Link href="/guide">คู่มือการใช้งาน</Link>
            <Link href="/about">เกี่ยวกับระบบ</Link>
            <Link href="/login">เข้าสู่ระบบ</Link>
            <Link href="/register">สมัครสมาชิก</Link>
          </nav>
        </div>

        <div>
          <h2>โครงการ</h2>
          <p className="footer-detail">
            <MapPin aria-hidden="true" />
            มหาวิทยาลัยเทคโนโลยีราชมงคลธัญบุรี
          </p>
          <p className="footer-detail">
            <ExternalLink aria-hidden="true" />
            <a href="https://www.rmutt.ac.th/contact/" target="_blank" rel="noreferrer">ช่องทางติดต่อมหาวิทยาลัย</a>
          </p>
        </div>
      </div>
      <div className="container site-footer__bottom">
        <p>ออกแบบระบบโดย Parinya Jansengrat</p>
        <p>© 2026 DuriSense</p>
      </div>
    </footer>
  );
}
