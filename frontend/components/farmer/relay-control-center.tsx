"use client";

import {
  CheckCircle2,
  Clock,
  LandPlot,
  LoaderCircle,
  Power,
  RefreshCw,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
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

  // Load relay channels callback for manual refresh
  const loadRelayChannels = useCallback(async () => {
    if (!farmId) return;
    try {
      const items = await apiFetch<RelayChannel[]>(`/farms/${farmId}/relays`);
      setChannels(items);
    } catch {
      addToast("error", "เกิดข้อผิดพลาด", "ไม่สามารถดึงข้อมูลแชนเนลรีเลย์ของสวนนี้ได้");
    } finally {
      setLoading(false);
    }
  }, [farmId]);

  useEffect(() => {
    let cancelled = false;
    if (!farmId) return;

    apiFetch<RelayChannel[]>(`/farms/${farmId}/relays`)
      .then((items) => {
        if (!cancelled) setChannels(items);
      })
      .catch(() => {
        if (!cancelled) addToast("error", "เกิดข้อผิดพลาด", "ไม่สามารถดึงข้อมูลแชนเนลรีเลย์ของสวนนี้ได้");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const interval = setInterval(() => {
      apiFetch<RelayChannel[]>(`/farms/${farmId}/relays`)
        .then((items) => {
          if (!cancelled) setChannels(items);
        })
        .catch(() => {});
    }, 8000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [farmId]);

  // Group channels by Plot / Zone / Station
  const groupedChannels = useMemo(() => {
    const map = new Map<
      string,
      {
        plotId: string | null;
        plotName: string;
        stationId: string;
        stationCode: string;
        channels: RelayChannel[];
      }
    >();

    for (const ch of channels) {
      const key = ch.plot_id || ch.station_id || "general";
      if (!map.has(key)) {
        map.set(key, {
          plotId: ch.plot_id,
          plotName: ch.plot_name || "แปลงทั่วไป",
          stationId: ch.station_id,
          stationCode: ch.station_code,
          channels: [],
        });
      }
      map.get(key)!.channels.push(ch);
    }

    const groups = Array.from(map.values());
    for (const g of groups) {
      g.channels.sort((a, b) => a.channel_number - b.channel_number);
    }
    // Sort groups alphabetically by plotName
    groups.sort((a, b) => a.plotName.localeCompare(b.plotName));
    return groups;
  }, [channels]);

  // Handle Command Toggle
  const handleToggleRelay = async (channel: RelayChannel) => {
    const targetState = channel.reported_state === "ON" ? "OFF" : "ON";
    const durationSeconds = targetState === "ON" ? selectedDuration : null;

    setActionLoadingId(channel.id);

    // Optimistic UI state
    setChannels((prev) =>
      prev.map((c) =>
        c.id === channel.id
          ? {
              ...c,
              desired_state: targetState,
            }
          : c
      )
    );

    try {
      const res = await apiFetch<RelayCommandResponse>(
        `/farms/${farmId}/relays/${channel.id}/command`,
        {
          method: "POST",
          body: JSON.stringify({
            target_state: targetState,
            duration_seconds: durationSeconds,
          }),
        }
      );

      // Successfully dispatched and confirmed
      setChannels((prev) =>
        prev.map((c) =>
          c.id === channel.id
            ? {
                ...c,
                desired_state: targetState,
                reported_state: targetState,
                last_command_at: res.created_at,
                last_ack_at: res.acknowledged_at,
              }
            : c
        )
      );

      const durationText =
        targetState === "ON"
          ? durationSeconds
            ? ` (ตั้งเวลาปิดอัตโนมัติ ${Math.round(durationSeconds / 60)} นาที)`
            : " (เปิดต่อเนื่อง)"
          : "";

      addToast(
        "success",
        `ส่งคำสั่ง ${targetState === "ON" ? "เปิด" : "ปิด"} สำเร็จ`,
        `แชนเนล: ${channel.display_name} [${channel.plot_name || "ทุกโซน"}]${durationText}`
      );
    } catch {
      // Revert optimistic on error
      setChannels((prev) =>
        prev.map((c) =>
          c.id === channel.id
            ? {
                ...c,
                desired_state: channel.reported_state,
              }
            : c
        )
      );
      addToast("error", "สั่งงานไม่สำเร็จ", `ไม่สามารถส่งคำสั่งไปยังกล่องควบคุมได้ กรุณาลองใหม่อีกครั้ง`);
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <>
      {/* Toast Notification Container */}
      <div
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          pointerEvents: "none",
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              pointerEvents: "auto",
              background: t.type === "success" ? "#065f46" : "#991b1b",
              color: "#fff",
              padding: "12px 18px",
              borderRadius: "8px",
              boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3)",
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              minWidth: 300,
              maxWidth: 420,
              animation: "fadeIn 0.2s ease-in-out",
            }}
          >
            <CheckCircle2 style={{ width: 20, height: 20, flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{t.title}</div>
              <div style={{ fontSize: 12.5, opacity: 0.92, marginTop: 2 }}>{t.detail}</div>
            </div>
            <button
              type="button"
              onClick={() => removeToast(t.id)}
              style={{
                background: "transparent",
                border: 0,
                color: "#fff",
                cursor: "pointer",
                padding: 0,
                opacity: 0.7,
              }}
            >
              <X style={{ width: 16 }} />
            </button>
          </div>
        ))}
      </div>

      {/* Page Header */}
      <div className="registry-header" style={{ marginBottom: "var(--space-4)" }}>
        <div>
          <span className="farmer-badge">Real-Time Actuator & Pump Control</span>
          <h1 style={{ margin: "var(--space-2) 0", fontSize: "1.75rem", fontWeight: 700 }}>
            ศูนย์ควบคุมรีเลย์ปั๊มน้ำและวาล์ว
          </h1>
          <p className="registry-subtitle">
            สั่งงานเปิด-ปิดปั๊มน้ำ สปริงเกลอร์ และวาล์วจ่ายปุ๋ยภาคสนามแยกตามแปลงอย่างเป็นระเบียบ พร้อมระบบแจ้งยืนยันสถานะ ACK
          </p>
        </div>
        <button
          type="button"
          className="farmer-button"
          onClick={loadRelayChannels}
          disabled={loading}
          style={{ gap: "var(--space-2)" }}
        >
          <RefreshCw className={loading ? "is-spinning" : ""} style={{ width: 16 }} />
          รีเฟรชสถานะ
        </button>
      </div>

      {/* Farm Selector & Pulse Duration Toolbar */}
      <div className="registry-toolbar" style={{ flexWrap: "wrap", gap: "var(--space-3)", marginBottom: "var(--space-5)" }}>
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
                  padding: "6px 12px",
                  border: 0,
                  background: selectedDuration === p.val ? "var(--brand-700)" : "#fff",
                  color: selectedDuration === p.val ? "#fff" : "var(--ink-800)",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 12.5,
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
      ) : groupedChannels.length === 0 ? (
        <div className="workspace-state">
          <Zap style={{ width: 36, height: 36, color: "var(--ink-400)", margin: "0 auto var(--space-2)" }} />
          <h2>ไม่พบแชนเนลรีเลย์ในสวนนี้</h2>
          <p>กรุณาตรวจสอบการลงทะเบียนสถานีตรวจอากาศและโมดูลรีเลย์</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
          {/* Grouped by Plot / Zone / Station */}
          {groupedChannels.map((grp) => {
            const activeCount = grp.channels.filter((c) => c.reported_state === "ON").length;

            return (
              <div
                key={grp.plotId || grp.stationCode}
                style={{
                  background: "#fff",
                  borderRadius: "14px",
                  border: "1px solid var(--line-strong)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                  padding: "1.25rem 1.5rem",
                }}
              >
                {/* Group Header: Plot Name & Station Info */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "0.75rem",
                    marginBottom: "1.25rem",
                    paddingBottom: "0.75rem",
                    borderBottom: "1px solid #f3f4f6",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <div
                      style={{
                        width: "38px",
                        height: "38px",
                        borderRadius: "10px",
                        background: "#ecfdf5",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#059669",
                      }}
                    >
                      <LandPlot size={22} />
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                        <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#111827", margin: 0 }}>
                          แปลง: {grp.plotName}
                        </h2>
                        <span
                          style={{
                            fontSize: "0.8rem",
                            color: "#4b5563",
                            background: "#f3f4f6",
                            padding: "2px 8px",
                            borderRadius: "6px",
                            fontWeight: 600,
                          }}
                        >
                          สถานี: {grp.stationCode}
                        </span>
                      </div>
                      <span style={{ fontSize: "0.85rem", color: "#6b7280" }}>
                        ชุดควบคุมรีเลย์ประจำแปลง 4 ช่องสัญญาณ (แชนเนล 1 - 4)
                      </span>
                    </div>
                  </div>

                  {/* Active status pill */}
                  <div>
                    <span
                      style={{
                        fontSize: "0.85rem",
                        fontWeight: 700,
                        padding: "0.35rem 0.85rem",
                        borderRadius: "20px",
                        background: activeCount > 0 ? "#ecfdf5" : "#f9fafb",
                        color: activeCount > 0 ? "#059669" : "#6b7280",
                        border: `1px solid ${activeCount > 0 ? "#a7f3d0" : "#e5e7eb"}`,
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      {activeCount > 0 ? (
                        <>
                          <span
                            style={{
                              width: "8px",
                              height: "8px",
                              borderRadius: "50%",
                              background: "#10b981",
                              display: "inline-block",
                              boxShadow: "0 0 8px #10b981",
                            }}
                          />
                          กำลังเปิดทำงาน {activeCount} / {grp.channels.length} ช่อง
                        </>
                      ) : (
                        <>
                          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#9ca3af", display: "inline-block" }} />
                          ปิดอยู่ทั้งหมด (0/{grp.channels.length})
                        </>
                      )}
                    </span>
                  </div>
                </div>

                {/* 4 Channels Grid for this Plot */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                    gap: "1rem",
                  }}
                >
                  {grp.channels.map((ch) => {
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
                          padding: "1.1rem 1.25rem",
                          boxShadow: isOn ? "0 6px 20px rgba(16, 185, 129, 0.12)" : "0 2px 6px rgba(0,0,0,0.03)",
                          transition: "all 0.2s ease-in-out",
                          position: "relative",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                        }}
                      >
                        {/* Top: Channel No. & Status */}
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
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

                            {/* Status Indicator */}
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              {isPending ? (
                                <span style={{ display: "flex", alignItems: "center", gap: "4px", color: "#d97706", fontSize: 12, fontWeight: 700 }}>
                                  <LoaderCircle className="is-spinning" style={{ width: 14 }} /> กำลังปรับ...
                                </span>
                              ) : isOn ? (
                                <span style={{ display: "flex", alignItems: "center", gap: "4px", color: "#10b981", fontSize: 12, fontWeight: 700 }}>
                                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", display: "inline-block", boxShadow: "0 0 8px #10b981" }} /> 🟢 ทำงาน (ON)
                                </span>
                              ) : (
                                <span style={{ display: "flex", alignItems: "center", gap: "4px", color: "#6b7280", fontSize: 12, fontWeight: 600 }}>
                                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#9ca3af", display: "inline-block" }} /> ⚪ ปิดอยู่ (OFF)
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Channel Details */}
                          <h3 style={{ fontSize: "1.05rem", fontWeight: 700, margin: "0 0 4px", color: "var(--ink-950)" }}>
                            {ch.display_name}
                          </h3>
                          <p style={{ fontSize: "0.85rem", color: "var(--ink-600)", margin: "0 0 1rem", minHeight: 36 }}>
                            {ch.description || `ควบคุมระบบสำหรับแปลง ${ch.plot_name || "ส่วนกลาง"}`}
                          </p>
                        </div>

                        {/* Power Button & Timestamp */}
                        <div>
                          <button
                            type="button"
                            disabled={isLoadingThis}
                            onClick={() => handleToggleRelay(ch)}
                            style={{
                              width: "100%",
                              padding: "11px 14px",
                              borderRadius: "var(--radius-sm)",
                              border: 0,
                              background: isOn ? "#ef4444" : "var(--brand-700)",
                              color: "#fff",
                              fontWeight: 700,
                              fontSize: 14,
                              cursor: isLoadingThis ? "not-allowed" : "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "var(--space-2)",
                              boxShadow: isOn ? "0 4px 14px rgba(239, 68, 68, 0.25)" : "0 4px 14px rgba(37, 99, 235, 0.2)",
                              transition: "transform 0.1s, background 0.15s",
                            }}
                          >
                            {isLoadingThis ? (
                              <LoaderCircle className="is-spinning" style={{ width: 17 }} />
                            ) : (
                              <Power style={{ width: 17 }} />
                            )}
                            {isOn ? "กดเพื่อปิดการทำงาน (TURN OFF)" : "กดเพื่อเปิดการทำงาน (TURN ON)"}
                          </button>

                          <div style={{ marginTop: "0.6rem", paddingTop: "0.4rem", borderTop: "1px solid var(--line)", fontSize: 11, color: "var(--ink-500)", display: "flex", justifyContent: "space-between" }}>
                            <span>แชนเนล {ch.channel_number}</span>
                            <span>{ch.last_ack_at ? `ยืนยัน: ${new Date(ch.last_ack_at).toLocaleTimeString("th-TH")}` : "ยังไม่มีประวัติ"}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Information & Safety Interlock Banner */}
          <div className="registry-surface" style={{ padding: "var(--space-4)", background: "var(--canvas-soft)", borderRadius: "10px" }}>
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
