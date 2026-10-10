"use client";

import {
  Bell,
  CheckCircle2,
  ClipboardList,
  Cpu,
  LandPlot,
  LineChart,
  LogOut,
  UserRound,
  X,
  Zap,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";

type InboxAlert = {
  id: string;
  title: string;
  message: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  state: "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
  created_at: string;
};

const links = [
  { href: "/telemetry", label: "ข้อมูลตรวจวัด", icon: LineChart },
  { href: "/relays", label: "ควบคุมรีเลย์", icon: Zap },
  { href: "/alerts", label: "การแจ้งเตือน", icon: Bell },
  { href: "/activities", label: "บันทึกกิจกรรม", icon: ClipboardList },
  { href: "/farms", label: "สวนและแปลง", icon: LandPlot },
  { href: "/devices", label: "อุปกรณ์", icon: Cpu },
  { href: "/profile", label: "โปรไฟล์", icon: UserRound },
];

export function FarmerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [inbox, setInbox] = useState<InboxAlert[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch alerts for bell badge
  useEffect(() => {
    let cancelled = false;
    const loadInbox = () => {
      apiFetch<InboxAlert[]>("/notifications/inbox?limit=5")
        .then((items) => {
          if (!cancelled) setInbox(items);
        })
        .catch(() => {});
    };

    loadInbox();
    const timer = setInterval(loadInbox, 30000); // Polling every 30s
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    if (showDropdown) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [showDropdown]);

  async function logout() {
    await apiFetch("/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const openCount = inbox.filter((i) => i.state === "OPEN").length;

  return (
    <div className="farmer-layout">
      <header className="farmer-header">
        <Link href="/farms" className="farmer-brand" aria-label="DuriSense พื้นที่จัดการสวน">
          <Image src="/brand/logo.png" width={178} height={54} alt="DuriSense" priority />
          <span>พื้นที่จัดการสวน</span>
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", position: "relative" }} ref={dropdownRef}>
          {/* Notification Bell Button */}
          <button
            type="button"
            className="farmer-icon-button"
            onClick={() => setShowDropdown(!showDropdown)}
            aria-label="การแจ้งเตือน"
            title="การแจ้งเตือน"
            style={{ position: "relative" }}
          >
            <Bell aria-hidden="true" />
            {openCount > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: "2px",
                  right: "2px",
                  background: "#dc2626",
                  color: "#fff",
                  fontSize: "0.7rem",
                  fontWeight: 800,
                  borderRadius: "10px",
                  minWidth: "18px",
                  height: "18px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 4px",
                  border: "2px solid #fff",
                }}
              >
                {openCount}
              </span>
            )}
          </button>

          {/* Quick Dropdown Panel */}
          {showDropdown && (
            <div
              style={{
                position: "absolute",
                top: "120%",
                right: 0,
                width: "320px",
                background: "#fff",
                borderRadius: "10px",
                boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
                border: "1px solid #e5e7eb",
                zIndex: 1000,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "0.75rem 1rem",
                  background: "#f9fafb",
                  borderBottom: "1px solid #e5e7eb",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "#111827" }}>
                  การแจ้งเตือน ({openCount} รายการใหม่)
                </div>
                <button
                  type="button"
                  onClick={() => setShowDropdown(false)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280" }}
                >
                  <X size={16} />
                </button>
              </div>

              <div style={{ maxHeight: "280px", overflowY: "auto" }}>
                {inbox.length === 0 ? (
                  <div style={{ padding: "1.5rem", textAlign: "center", color: "#6b7280", fontSize: "0.85rem" }}>
                    <CheckCircle2 size={28} color="#10b981" style={{ margin: "0 auto 0.5rem auto" }} />
                    ไม่มีการแจ้งเตือนค้างอยู่
                  </div>
                ) : (
                  inbox.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        padding: "0.75rem 1rem",
                        borderBottom: "1px solid #f3f4f6",
                        background: item.state === "OPEN" ? "#fef2f2" : "#fff",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.2rem" }}>
                        <span
                          style={{
                            fontSize: "0.65rem",
                            fontWeight: 700,
                            padding: "0.1rem 0.35rem",
                            borderRadius: "3px",
                            background: item.severity === "CRITICAL" ? "#dc2626" : "#f59e0b",
                            color: "#fff",
                          }}
                        >
                          {item.severity}
                        </span>
                        <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#111827" }}>
                          {item.title}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#4b5563", lineHeight: 1.3 }}>
                        {item.message}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <Link
                href="/alerts"
                onClick={() => setShowDropdown(false)}
                style={{
                  display: "block",
                  padding: "0.75rem",
                  textAlign: "center",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  color: "#059669",
                  background: "#f9fafb",
                  textDecoration: "none",
                  borderTop: "1px solid #e5e7eb",
                }}
              >
                ดูทั้งหมดในศูนย์แจ้งเตือน →
              </Link>
            </div>
          )}

          {/* Logout Button */}
          <button className="farmer-icon-button" type="button" onClick={logout} aria-label="ออกจากระบบ" title="ออกจากระบบ">
            <LogOut aria-hidden="true" />
          </button>
        </div>
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
