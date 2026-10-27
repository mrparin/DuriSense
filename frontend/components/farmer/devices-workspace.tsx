"use client";

import { Activity, Cpu, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { DeviceHealthCenter, Farm } from "./device-health-center";
import { DeviceRegistry } from "./device-registry";

export function DevicesWorkspace() {
  const [activeView, setActiveView] = useState<"health" | "registry">("health");
  const [farms, setFarms] = useState<Farm[]>([]);
  const [farmId, setFarmId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiFetch<Farm[]>("/farms")
      .then((items) => {
        if (cancelled) return;
        setFarms(items);
        if (items.length > 0) setFarmId(items[0].id);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Top View Selector Switcher */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
          background: "var(--surface-card)",
          padding: "0.5rem 0.75rem",
          borderRadius: "12px",
          border: "1px solid var(--border-subtle)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}
      >
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            onClick={() => setActiveView("health")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.55rem 1.15rem",
              borderRadius: "8px",
              border: "none",
              fontWeight: 700,
              fontSize: "0.9rem",
              cursor: "pointer",
              background: activeView === "health" ? "var(--brand-600)" : "transparent",
              color: activeView === "health" ? "#ffffff" : "var(--text-secondary)",
              transition: "all 0.15s ease",
            }}
          >
            <Activity style={{ width: 17, height: 17 }} />
            สุขภาพอุปกรณ์ & รายงานสัญญาณขาดช่วง
          </button>

          <button
            onClick={() => setActiveView("registry")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.55rem 1.15rem",
              borderRadius: "8px",
              border: "none",
              fontWeight: 700,
              fontSize: "0.9rem",
              cursor: "pointer",
              background: activeView === "registry" ? "var(--brand-600)" : "transparent",
              color: activeView === "registry" ? "#ffffff" : "var(--text-secondary)",
              transition: "all 0.15s ease",
            }}
          >
            <Cpu style={{ width: 17, height: 17 }} />
            จัดการทะเบียนอุปกรณ์
          </button>
        </div>
      </div>

      {/* Content View */}
      {loading ? (
        <div style={{ padding: "3rem", textAlign: "center" }}>
          <LoaderCircle
            style={{ width: 32, height: 32, color: "var(--brand-600)", animation: "spin 1s linear infinite" }}
          />
          <p style={{ marginTop: "0.5rem", color: "var(--text-secondary)" }}>กำลังโหลดบริบทสวน...</p>
        </div>
      ) : activeView === "health" ? (
        <DeviceHealthCenter
          farms={farms}
          selectedFarmId={farmId}
          onFarmChange={setFarmId}
          onSwitchToRegistry={() => setActiveView("registry")}
        />
      ) : (
        <DeviceRegistry onSwitchToHealth={() => setActiveView("health")} />
      )}
    </div>
  );
}
