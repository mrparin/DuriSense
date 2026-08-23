"use client";

import {
  CheckCircle2,
  Clock,
  LoaderCircle,
  Power,
  RefreshCw,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type Farm = { id: string; name: string };

type RelayChannel = {
  id: string;
  farm_id: string;
  plot_id: string | null;
  plot_name: string | null;
  station_id: string;
  station_code: string;
  channel_number: number;
  display_name: string;
  gpio_pin: number | null;
  description: string | null;
  desired_state: "ON" | "OFF";
  reported_state: "ON" | "OFF";
  last_command_at: string | null;
  last_ack_at: string | null;
};

type RelayCommandResponse = {
  id: string;
  channel_id: string;
  target_state: "ON" | "OFF";
  duration_seconds: number | null;
  state: string;
  created_at: string;
  acknowledged_at: string | null;
};

type ToastNotification = {
  id: string;
  type: "success" | "error";
  title: string;
  detail: string;
};

export function RelayControlCenter() {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [farmId, setFarmId] = useState("");
  const [channels, setChannels] = useState<RelayChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<number | null>(900); // Default 15 mins (900s)
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  // Toast Helper
  const addToast = (type: "success" | "error", title: string, detail: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, title, detail }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000); // Auto dismiss 4s
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Load farms
  useEffect(() => {
    let cancelled = false;
    apiFetch<Farm[]>("/farms")
      .then((items) => {
        if (cancelled) return;
        setFarms(items);
        if (items.length > 0) {
          setFarmId(items[0].id);
        } else {
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          addToast("error", "เกิดข้อผิดพลาด", "ไม่สามารถโหลดข้อมูลสวนได้ กรุณาตรวจสอบการเข้าสู่ระบบ");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Load relay channels callback
  const loadRelayChannels = useCallback(async () => {
    if (!farmId) return;
    try {
      const data = await apiFetch<RelayChannel[]>(`/farms/${farmId}/relays`);
      setChannels(data);
    } catch {
      // Silent in background poll
    } finally {
      setLoading(false);
    }
  }, [farmId]);

  useEffect(() => {
    let active = true;
    if (!farmId) return;
    apiFetch<RelayChannel[]>(`/farms/${farmId}/relays`)
      .then((data) => {
        if (active) {
          setChannels(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });

    const interval = setInterval(() => {
      loadRelayChannels();
    }, 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [farmId, loadRelayChannels]);

  // Handle Relay Command Dispatch
  const handleToggleRelay = async (channel: RelayChannel) => {
    const nextState = channel.reported_state === "ON" ? "OFF" : "ON";
    setActionLoadingId(channel.id);

    try {
      const payload = {
        target_state: nextState,
        duration_seconds: nextState === "ON" ? selectedDuration : null,
      };

      const res = await apiFetch<RelayCommandResponse>(
        `/farms/${farmId}/relays/${channel.id}/command`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      );

      const actionText = nextState === "ON" ? "เปิดทำงาน" : "ปิดการทำงาน";
      const timerInfo = nextState === "ON" && selectedDuration ? ` (ตั้งเวลา ${selectedDuration / 60} นาที)` : "";

      addToast(
        "success",
        `ส่งคำสั่ง ${actionText} ${channel.display_name} แล้ว`,
        `สถานะคำสั่ง: ${res.state}${timerInfo}`
      );
      await loadRelayChannels();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการส่งคำสั่งรีเลย์";
      addToast("error", "ไม่สามารถส่งคำสั่งได้", msg);
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <>
      {/* Toast Notification Container (Floating Bottom-Right) */}
      <div
        style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          maxWidth: "360px",
          pointerEvents: "none",
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              pointerEvents: "auto",
              background: t.type === "success" ? "#064e3b" : "#7f1d1d",
              color: "#fff",
              padding: "12px 16px",
              borderRadius: "10px",
              boxShadow: "0 10px 25px -5px rgba(0,0,0,0.3)",
              display: "flex",
              alignItems: "flex-start",
              gap: "12px",
              animation: "fadeIn 0.2s ease-out",
              border: `1px solid ${t.type === "success" ? "#10b981" : "#ef4444"}`,
            }}
          >
            {t.type === "success" ? (
              <CheckCircle2 style={{ width: 20, height: 20, color: "#34d399", flexShrink: 0, marginTop: 2 }} />
            ) : (
              <Zap style={{ width: 20, height: 20, color: "#fca5a5", flexShrink: 0, marginTop: 2 }} />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: "14px", lineHeight: "1.3" }}>{t.title}</div>
              <div style={{ fontSize: "12px", opacity: 0.9, marginTop: "2px" }}>{t.detail}</div>
            </div>
            <button
              type="button"
              onClick={() => removeToast(t.id)}
              style={{
                background: "none",
                border: 0,
                color: "#fff",
                opacity: 0.7,
                cursor: "pointer",
                padding: 0,
              }}
            >
              <X style={{ width: 16, height: 16 }} />
            </button>
          </div>
        ))}
      </div>

      <div className="workspace-heading">
        <div>
          <p className="eyebrow">Real-Time Actuator & Pump Control</p>
          <h1>ศูนย์ควบคุมรีเลย์ปั๊มน้ำและวาล์ว</h1>
          <p>สั่งงานเปิด-ปิดปั๊มน้ำ สปริงเกลอร์ และวาล์วจ่ายปุ๋ยภาคสนาม พร้อมระบบแจ้งยืนยันสถานะ ACK</p>
        </div>
        <div className="workspace-heading__actions">
          <button className="button button--secondary" onClick={loadRelayChannels}>
            <RefreshCw style={{ width: 16 }} /> รีเฟรชสถานะ
          </button>
        </div>
      </div>

      {/* Farm Selector Toolbar */}
      <div className="registry-toolbar" style={{ flexWrap: "wrap", gap: "var(--space-3)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <label htmlFor="farm-select"><strong>สวน:</strong></label>
          <select
            id="farm-select"
            value={farmId}
            onChange={(e) => setFarmId(e.target.value)}
            style={{ fontWeight: 600 }}
          >
            {farms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>

        {/* Pulse Duration Preset Selector */}
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginLeft: "auto", flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: "var(--ink-700)", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}>
            <Clock style={{ width: 15 }} /> ตั้งเวลาปิดอัตโนมัติ (Pulse Timer):
          </span>
          <div className="button-group" style={{ display: "flex", border: "1px solid var(--line-strong)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
            {[
              { label: "5 นาที", val: 300 },
              { label: "15 นาที", val: 900 },
              { label: "30 นาที", val: 1800 },
              { label: "1 ชั่วโมง", val: 3600 },
              { label: "เปิดค้างไว้", val: null },
            ].map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setSelectedDuration(p.val)}
                style={{
                  padding: "5px 10px",
                  border: 0,
                  background: selectedDuration === p.val ? "var(--brand-700)" : "#fff",
                  color: selectedDuration === p.val ? "#fff" : "var(--ink-800)",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 12,
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="workspace-state"><LoaderCircle className="is-spinning" /><h2>กำลังเชื่อมต่ออุปกรณ์ควบคุม...</h2></div>
      ) : (
        <div style={{ display: "grid", gap: "var(--space-6)", marginTop: "var(--space-4)" }}>

          {/* Relay Channels Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "var(--space-4)" }}>
            {channels.map((ch) => {
              const isOn = ch.reported_state === "ON";
              const isPending = ch.desired_state !== ch.reported_state;
              const isLoadingThis = actionLoadingId === ch.id;

              return (
                <div
                  key={ch.id}
                  style={{
                    background: "#fff",
                    border: isOn ? "2px solid #10b981" : "1px solid var(--line-strong)",
                    borderRadius: "var(--radius-md)",
                    padding: "var(--space-5)",
                    boxShadow: isOn ? "0 6px 20px rgba(16, 185, 129, 0.12)" : "0 2px 8px rgba(0,0,0,0.04)",
                    transition: "all 0.2s ease-in-out",
                    position: "relative",
                  }}
                >
                  {/* Card Top: Channel Number & Status Indicator */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-3)" }}>
                    <span
                      style={{
                        background: "var(--canvas-soft)",
                        border: "1px solid var(--line-strong)",
                        color: "var(--ink-700)",
                        padding: "2px 8px",
                        borderRadius: "12px",
                        fontSize: "12px",
                        fontWeight: 700,
                      }}
                    >
                      แชนเนล {ch.channel_number} {ch.gpio_pin != null ? `(GPIO ${ch.gpio_pin})` : ""}
                    </span>

                    {/* Status Badge */}
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      {isPending ? (
                        <span style={{ display: "flex", alignItems: "center", gap: "4px", color: "#d97706", fontSize: 12, fontWeight: 700 }}>
                          <LoaderCircle className="is-spinning" style={{ width: 14 }} /> กำลังปรับ...
                        </span>
                      ) : isOn ? (
                        <span style={{ display: "flex", alignItems: "center", gap: "4px", color: "#10b981", fontSize: 12, fontWeight: 700 }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", display: "inline-block", boxShadow: "0 0 8px #10b981" }} /> 🟢 กำลังทำงาน (ON)
                        </span>
                      ) : (
                        <span style={{ display: "flex", alignItems: "center", gap: "4px", color: "#6b7280", fontSize: 12, fontWeight: 600 }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#9ca3af", display: "inline-block" }} /> ⚪ ปิดอยู่ (OFF)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Channel Details */}
                  <h3 style={{ fontSize: 17, margin: "0 0 4px", color: "var(--ink-950)" }}>
                    {ch.display_name}
                  </h3>
                  <p style={{ fontSize: 13, color: "var(--ink-600)", margin: "0 0 var(--space-4)", minHeight: 38 }}>
                    {ch.description || `ควบคุมระบบสำหรับแปลง ${ch.plot_name || "ส่วนกลาง"}`}
                  </p>

                  {/* Big Power Control Button */}
                  <button
                    type="button"
                    disabled={isLoadingThis}
                    onClick={() => handleToggleRelay(ch)}
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      borderRadius: "var(--radius-sm)",
                      border: 0,
                      background: isOn ? "#ef4444" : "var(--brand-700)",
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: 15,
                      cursor: isLoadingThis ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "var(--space-2)",
                      boxShadow: isOn ? "0 4px 14px rgba(239, 68, 68, 0.3)" : "0 4px 14px rgba(37, 99, 235, 0.25)",
                      transition: "transform 0.1s, background 0.15s",
                    }}
                  >
                    {isLoadingThis ? (
                      <LoaderCircle className="is-spinning" style={{ width: 18 }} />
                    ) : (
                      <Power style={{ width: 18 }} />
                    )}
                    {isOn ? "กดเพื่อปิดการทำงาน (TURN OFF)" : "กดเพื่อเปิดการทำงาน (TURN ON)"}
                  </button>

                  {/* Footer timestamps */}
                  <div style={{ marginTop: "var(--space-3)", paddingTop: "var(--space-2)", borderTop: "1px solid var(--line)", fontSize: 11, color: "var(--ink-500)", display: "flex", justifyContent: "space-between" }}>
                    <span>แปลง: {ch.plot_name || "ทุกโซน"}</span>
                    <span>{ch.last_ack_at ? `ยืนยันล่าสุด: ${new Date(ch.last_ack_at).toLocaleTimeString("th-TH")}` : "ยังไม่มีประวัติ"}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Information & Safety Interlock Banner */}
          <div className="registry-surface" style={{ padding: "var(--space-4)", background: "var(--canvas-soft)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-3)" }}>
              <Zap style={{ color: "var(--brand-700)", width: 22, height: 22, marginTop: 2 }} />
              <div>
                <h4 style={{ margin: "0 0 4px", fontSize: 14 }}>ระบบความปลอดภัยและการสั่งการ (Safety Interlocks)</h4>
                <p style={{ margin: 0, fontSize: 13, color: "var(--ink-700)" }}>
                  การสั่งงานเปิดรีเลย์จะส่งสัญญาณคำสั่งผ่าน MQTT Protocol ไปยังกล่องควบคุมภาคสนามโดยตรง หากเลือกตั้งเวลา (Pulse Timer) กล่องฮาร์ดแวร์จะนับถอยหลังและปิดการทำงานให้อัตโนมัติแม้การเชื่อมต่ออินเทอร์เน็ตจะขาดหายไป
                </p>
              </div>
            </div>
          </div>

        </div>
      )}
    </>
  );
}
