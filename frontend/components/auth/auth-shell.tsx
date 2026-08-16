import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { BrandLogo } from "../brand-logo";

type AuthShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
};

export function AuthShell({ eyebrow, title, description, children }: AuthShellProps) {
  return (
    <main className="auth-layout">
      <section className="auth-visual" aria-label="DuriSense">
        <div className="auth-visual__media">
          <Image
            src="/images/durian-orchard-hero.png"
            alt="สวนทุเรียนที่ติดตั้งสถานีตรวจอากาศ"
            fill
            priority
            sizes="(max-width: 960px) 0px, 46vw"
          />
        </div>
        <div className="auth-visual__overlay" aria-hidden="true" />
        <div className="auth-visual__content">
          <BrandLogo priority />
          <p>เห็นความเปลี่ยนแปลงของแปลงได้ชัดขึ้น จากข้อมูลอากาศ ดิน และอุปกรณ์ในที่เดียว</p>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-panel__inner">
          <Link className="back-link" href="/">
            <ArrowLeft aria-hidden="true" />
            กลับหน้าหลัก
          </Link>

          <header className="auth-heading">
            <p className="eyebrow">{eyebrow}</p>
            <h1>{title}</h1>
            <p>{description}</p>
          </header>

          {children}
        </div>
      </section>
    </main>
  );
}
