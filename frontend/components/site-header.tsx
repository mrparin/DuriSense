"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
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
  const pathname = usePathname();

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
            <Link className="button button--ghost-light" href="/login" onClick={() => setOpen(false)}>
              เข้าสู่ระบบ
            </Link>
            <Link className="button button--accent" href="/register" onClick={() => setOpen(false)}>
              สมัครสมาชิก
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
