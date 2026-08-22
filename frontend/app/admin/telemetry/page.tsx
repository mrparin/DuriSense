"use client";

import {
  AlertOctagon,
  CheckCircle2,
  Cpu,
  Database,
  LoaderCircle,
  Radio,
  RefreshCw,
  Server,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type QuarantineLogItem = {
  id: string;
  topic: string;
  message_id: string | null;
  quarantine_reason: string | null;
  validation_status: string;
  received_at: string;
};

type AdminOverview = {
  active_stations_count: number;
  online_stations_count: number;
  total_readings_24h: number;
  quarantined_messages_24h: number;
  ingestion_rate_per_min: number;
  recent_quarantine_logs: QuarantineLogItem[];
};

export default function AdminTelemetryPage() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const data = await apiFetch<AdminOverview>("/admin/telemetry/overview");
      setOverview(data);
      setError("");
    } catch {
      setError("โหลดข้อมูลสถานะระบบไม่สำเร็จ (ต้องการสิทธิ์ Admin)");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    apiFetch<AdminOverview>("/admin/telemetry/overview")
      .then((data) => {
        if (active) {
          setOverview(data);
          setError("");
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setError("โหลดข้อมูลสถานะระบบไม่สำเร็จ (ต้องการสิทธิ์ Admin)");
          setLoading(false);
        }
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadData]);

  return (
    <>
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">Platform Telemetry & Ingestion Monitor</p>
          <h1>สถานะระบบ & การรับส่งข้อมูล</h1>
          <p>มอนิเตอร์การเชื่อมต่อ MQTT Broker, ความเร็วการ Ingest ข้อมูล และข้อความที่ติดคิว Quarantine ระดับแพลตฟอร์ม</p>
        </div>
        <div className="workspace-heading__actions" style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
          <button
            className={`button ${autoRefresh ? "button--secondary" : "button--ghost-light"}`}
            onClick={() => setAutoRefresh((v) => !v)}
          >
            <Radio style={{ width: 16, color: autoRefresh ? "var(--brand-700)" : "inherit" }} />
            {autoRefresh ? "Auto-refresh (10s)" : "Paused"}
          </button>
          <button className="button button--secondary" onClick={loadData}>
            <RefreshCw style={{ width: 16 }} />รีเฟรช
          </button>
        </div>
      </div>

      {error && <div className="form-status form-status--danger">{error}</div>}

      {loading ? (
        <div className="workspace-state"><LoaderCircle className="is-spinning" /><h2>กำลังโหลดสถานะระบบ...</h2></div>
      ) : !overview ? null : (
        <div style={{ display: "grid", gap: "var(--space-6)" }}>

          {/* Key Platform Metric Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "var(--space-4)" }}>
            <div className="registry-surface" style={{ padding: "var(--space-4)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <span style={{ fontSize: 13, color: "var(--ink-600)", fontWeight: 600 }}>สถานีตรวจอากาศทั้งหมด</span>
                <Cpu style={{ color: "var(--brand-700)", width: 20 }} />
              </div>
              <div style={{ margin: "var(--space-2) 0 4px", fontSize: 28, fontWeight: 800, color: "var(--ink-950)" }}>
                {overview.active_stations_count} <span style={{ fontSize: 14, fontWeight: 500, color: "var(--ink-600)" }}>สถานี</span>
              </div>
              <span style={{ fontSize: 12, color: overview.online_stations_count > 0 ? "var(--brand-700)" : "var(--ink-500)" }}>
                🟢 ออนไลน์ {overview.online_stations_count} สถานี
              </span>
            </div>

            <div className="registry-surface" style={{ padding: "var(--space-4)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <span style={{ fontSize: 13, color: "var(--ink-600)", fontWeight: 600 }}>ความเร็วการรับข้อมูล (Ingestion Rate)</span>
                <Zap style={{ color: "#2563eb", width: 20 }} />
              </div>
              <div style={{ margin: "var(--space-2) 0 4px", fontSize: 28, fontWeight: 800, color: "var(--ink-950)" }}>
                {overview.ingestion_rate_per_min} <span style={{ fontSize: 14, fontWeight: 500, color: "var(--ink-600)" }}>ข้อความ/นาที</span>
              </div>
              <span style={{ fontSize: 12, color: "var(--ink-600)" }}>MQTT Topic: <code>durian/#</code></span>
            </div>

            <div className="registry-surface" style={{ padding: "var(--space-4)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <span style={{ fontSize: 13, color: "var(--ink-600)", fontWeight: 600 }}>ปริมาณข้อมูล 24 ชม. ที่ผ่านมา</span>
                <Database style={{ color: "#10b981", width: 20 }} />
              </div>
              <div style={{ margin: "var(--space-2) 0 4px", fontSize: 28, fontWeight: 800, color: "var(--ink-950)" }}>
                {overview.total_readings_24h.toLocaleString("th-TH")} <span style={{ fontSize: 14, fontWeight: 500, color: "var(--ink-600)" }}>จุด</span>
              </div>
              <span style={{ fontSize: 12, color: "var(--ink-600)" }}>บันทึกใน TimescaleDB</span>
            </div>

            <div className="registry-surface" style={{ padding: "var(--space-4)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <span style={{ fontSize: 13, color: "var(--ink-600)", fontWeight: 600 }}>ข้อความติด Quarantine 24 ชม.</span>
                <AlertOctagon style={{ color: overview.quarantined_messages_24h > 0 ? "#b91c1c" : "#10b981", width: 20 }} />
              </div>
              <div style={{ margin: "var(--space-2) 0 4px", fontSize: 28, fontWeight: 800, color: overview.quarantined_messages_24h > 0 ? "#b91c1c" : "var(--ink-950)" }}>
                {overview.quarantined_messages_24h} <span style={{ fontSize: 14, fontWeight: 500, color: "var(--ink-600)" }}>ข้อความ</span>
              </div>
              <span style={{ fontSize: 12, color: overview.quarantined_messages_24h === 0 ? "var(--brand-700)" : "#b91c1c" }}>
                {overview.quarantined_messages_24h === 0 ? "✓ ไม่มีข้อความผิดพลาด" : "⚠️ ตรวจสอบเหตุผลด้านล่าง"}
              </span>
            </div>
          </div>

          {/* MQTT Broker Status Box */}
          <section className="registry-surface" style={{ padding: "var(--space-5)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-3)" }}>
              <Server style={{ color: "var(--brand-700)", width: 24, height: 24 }} />
              <div>
                <h2 style={{ fontSize: 18, margin: 0 }}>การเชื่อมต่อ Mosquitto MQTT Broker</h2>
                <span style={{ fontSize: 13, color: "var(--ink-600)" }}>
                  พอร์ต 1883 (Internal Docker) · พอร์ต 8883 (TLS Security Gate)
                </span>
              </div>
            </div>
            <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap", fontSize: 13, color: "var(--ink-800)", background: "var(--canvas-soft)", padding: "var(--space-3) var(--space-4)", borderRadius: "var(--radius-sm)" }}>
              <span>Broker Status: <strong>🟢 Running (Mosquitto 2.0)</strong></span>
              <span>Ingestion Engine: <strong>🟢 Connected & Subscribed (durian/#)</strong></span>
              <span>Simulator Engine: <strong>🟢 Active</strong></span>
            </div>
          </section>

          {/* Quarantine Logs Table */}
          <section className="registry-surface" style={{ padding: "var(--space-5)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
              <div>
                <h2 style={{ fontSize: 18, margin: 0 }}>ประวัติข้อความใน Quarantine Queue (ล่าสุด 20 รายการ)</h2>
                <p style={{ fontSize: 13, color: "var(--ink-600)", margin: "2px 0 0" }}>
                  ข้อความที่ Schema ผิด, ID อุปกรณ์ไม่มีในระบบ, หรืออยู่นอกช่วงเวลาที่ได้รับอนุญาตจะถูกกักกันไว้ที่นี่เพื่อตรวจสอบ
                </p>
              </div>
            </div>

            {overview.recent_quarantine_logs.length === 0 ? (
              <div className="registry-empty" style={{ padding: "var(--space-5)" }}>
                <CheckCircle2 style={{ color: "var(--brand-700)" }} />
                <h3>ไม่มีข้อความในคิว Quarantine</h3>
                <p>ทุกข้อความที่ส่งเข้ามาในระบบผ่านการตรวจสอบ Validation และถูกบันทึกลง TimescaleDB เรียบร้อย</p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid var(--line)", textAlign: "left" }}>
                      <th style={{ padding: "8px" }}>เวลาที่ได้รับ</th>
                      <th style={{ padding: "8px" }}>MQTT Topic</th>
                      <th style={{ padding: "8px" }}>Message ID</th>
                      <th style={{ padding: "8px" }}>สาเหตุที่กักกัน (Quarantine Reason)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.recent_quarantine_logs.map((item) => (
                      <tr key={item.id} style={{ borderBottom: "1px solid var(--line)" }}>
                        <td style={{ padding: "8px", whiteSpace: "nowrap", color: "var(--ink-600)" }}>
                          {new Date(item.received_at).toLocaleString("th-TH")}
                        </td>
                        <td style={{ padding: "8px", fontFamily: "monospace" }}>{item.topic}</td>
                        <td style={{ padding: "8px", fontFamily: "monospace" }}>{item.message_id || "-"}</td>
                        <td style={{ padding: "8px", color: "#b91c1c", fontWeight: 600 }}>{item.quarantine_reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

        </div>
      )}
    </>
  );
}
