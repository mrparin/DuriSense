"use client";

import { Cpu, LandPlot, LineChart, LogOut, UserRound } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

const links = [
  { href: "/telemetry", label: "ข้อมูลตรวจวัด", icon: LineChart },
  { href: "/farms", label: "สวนและแปลง", icon: LandPlot },
  { href: "/devices", label: "อุปกรณ์", icon: Cpu },
  { href: "/profile", label: "โปรไฟล์", icon: UserRound },
];

export function FarmerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await apiFetch("/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="farmer-layout">
      <header className="farmer-header">
        <Link href="/farms" className="farmer-brand" aria-label="DuriSense พื้นที่จัดการสวน">
          <Image src="/brand/logo.png" width={178} height={54} alt="DuriSense" priority />
          <span>พื้นที่จัดการสวน</span>
        </Link>
        <button className="farmer-icon-button" type="button" onClick={logout} aria-label="ออกจากระบบ" title="ออกจากระบบ">
          <LogOut aria-hidden="true" />
        </button>
      </header>
      <div className="farmer-frame">
        <nav className="farmer-nav" aria-label="เมนูจัดการสวน">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={pathname.startsWith(href) ? "page" : undefined}
            >
              <Icon aria-hidden="true" />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <main className="farmer-main">{children}</main>
      </div>
    </div>
  );
}
