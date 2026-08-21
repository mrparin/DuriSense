"use client";

import { LoaderCircle, LogOut, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { SessionUser, workspacePath } from "@/lib/session";
import { BrandLogo } from "./brand-logo";

const navigation = [
  { href: "/", label: "หน้าหลัก" },
  { href: "/#capabilities", label: "ความสามารถ" },
  { href: "/#devices", label: "อุปกรณ์" },
  { href: "/guide", label: "คู่มือ" },
  { href: "/about", label: "เกี่ยวกับระบบ" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState<SessionUser | null | undefined>(undefined);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    let active = true;
    apiFetch<SessionUser>("/auth/session")
      .then((user) => { if (active) setSession(user); })
      .catch(() => { if (active) setSession(null); });
    return () => { active = false; };
  }, []);

  async function logout() {
    setLogoutError("");
    setLoggingOut(true);
    try {
      await apiFetch("/auth/logout", { method: "POST" });
      setSession(null);
      setOpen(false);
      router.replace("/");
      router.refresh();
    } catch {
      setLogoutError("ออกจากระบบไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <BrandLogo priority />

        <button
          className="icon-button site-header__menu-button"
          type="button"
          aria-label={open ? "ปิดเมนู" : "เปิดเมนู"}
          aria-expanded={open}
          aria-controls="site-navigation"
          title={open ? "ปิดเมนู" : "เปิดเมนู"}
          onClick={() => setOpen((current) => !current)}
        >
          {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>

        <nav
          id="site-navigation"
          className={`site-navigation${open ? " site-navigation--open" : ""}`}
          aria-label="เมนูหลัก"
        >
          <div className="site-navigation__links">
            {navigation.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
          <div className="site-navigation__actions">
            {session === undefined ? (
              <span className="site-session-status" role="status"><LoaderCircle className="is-spinning" aria-hidden="true" />กำลังตรวจสอบบัญชี</span>
            ) : session ? (
              <>
                {logoutError && <span className="site-session-error" role="alert">{logoutError}</span>}
                <Link className="button button--accent" href={workspacePath(session)} onClick={() => setOpen(false)}>
                  {session.roles.includes("ADMIN") ? "พื้นที่ผู้ดูแล" : "พื้นที่จัดการสวน"}
                </Link>
                <button className="button button--ghost-light" type="button" onClick={logout} disabled={loggingOut}>
                  {loggingOut ? <LoaderCircle className="is-spinning" aria-hidden="true" /> : <LogOut aria-hidden="true" />}
                  ออกจากระบบ
                </button>
              </>
            ) : (
              <>
                <Link className="button button--ghost-light" href="/login" onClick={() => setOpen(false)}>
                  เข้าสู่ระบบ
                </Link>
                <Link className="button button--accent" href="/register" onClick={() => setOpen(false)}>
                  สมัครสมาชิก
                </Link>
              </>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
