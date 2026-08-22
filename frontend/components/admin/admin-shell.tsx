"use client";

import { Activity, LogOut, ShieldCheck, UserCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await apiFetch("/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="admin-layout">
      <header className="admin-header">
        <Link href="/admin/users" className="admin-brand" aria-label="DuriSense Admin">
          <Image src="/brand/logo.png" width={178} height={54} alt="DuriSense" priority />
          <span>ผู้ดูแลระบบ</span>
        </Link>
        <button className="admin-icon-button" type="button" onClick={logout} title="ออกจากระบบ" aria-label="ออกจากระบบ"><LogOut aria-hidden="true" /></button>
      </header>
      <div className="admin-frame">
        <nav className="admin-nav" aria-label="เมนูผู้ดูแลระบบ">
          <Link href="/admin/telemetry" aria-current={pathname === "/admin/telemetry" ? "page" : undefined}><Activity aria-hidden="true" />สถานะระบบ & Ingestion</Link>
          <Link href="/admin/users" aria-current={pathname === "/admin/users" ? "page" : undefined}><UserCheck aria-hidden="true" />ตรวจสอบสมาชิก</Link>
          <Link href="/admin/security" aria-current={pathname === "/admin/security" ? "page" : undefined}><ShieldCheck aria-hidden="true" />ความปลอดภัย</Link>
        </nav>
        <main className="admin-main">{children}</main>
      </div>
    </div>
  );
}
