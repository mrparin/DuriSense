import { ArrowLeft, MapPinOff } from "lucide-react";
import Link from "next/link";
import { PublicShell } from "@/components/public-shell";

export default function NotFound() {
  return (
    <PublicShell>
      <section className="not-found">
        <div className="container not-found__inner">
          <MapPinOff aria-hidden="true" />
          <p className="eyebrow">404</p>
          <h1>ไม่พบหน้าที่ต้องการ</h1>
          <p>เส้นทางนี้อาจถูกย้าย หรือยังไม่เปิดใช้งานในระยะปัจจุบัน</p>
          <Link className="button button--primary" href="/">
            <ArrowLeft aria-hidden="true" />
            กลับหน้าหลัก
          </Link>
        </div>
      </section>
    </PublicShell>
  );
}
