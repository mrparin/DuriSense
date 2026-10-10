"use client";

import {
  AlertCircle,
  AlertTriangle,
  Bell,
  Check,
  CheckCircle2,
  Clock,
  Eye,
  Filter,
  LoaderCircle,
  Plus,
  Radio,
  Settings,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type Farm = { id: string; name: string };

type AlertSeverity = "INFO" | "WARNING" | "CRITICAL";
type AlertState = "OPEN" | "ACKNOWLEDGED" | "RESOLVED";

type AlertRule = {
  id: string;
  tenant_id: string;
  farm_id: string;
  plot_id: string | null;
  station_id: string | null;
  name: string;
  metric_type: string;
  operator: string;
  threshold_min: number | null;
  threshold_max: number | null;
  duration_seconds: number;
  hysteresis: number;
  severity: AlertSeverity;
  is_active: boolean;
  notify_channels: string[];
  created_at: string;
};

type AlertEvent = {
  id: string;
  tenant_id: string;
  farm_id: string;
  rule_id: string;
  rule_name: string | null;
  station_id: string | null;
  plot_id: string | null;
  severity: AlertSeverity;
  state: AlertState;
  triggered_value: number | null;
  title: string;
  message: string;
  acknowledged_by_id: string | null;
  acknowledged_by_name: string | null;
  acknowledged_at: string | null;
  acknowledge_note: string | null;
  resolved_at: string | null;
  resolve_reason: string | null;
  created_at: string;
};

type AlertMetricsSummary = {
  open_count: number;
  acknowledged_count: number;
  critical_count: number;
  warning_count: number;
  active_rules_count: number;
};

type NotificationPreference = {
  id: string;
  user_id: string;
  email_enabled: boolean;
  in_app_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  min_severity: AlertSeverity;
};

type ToastNotification = {
  id: string;
  type: "success" | "error";
  title: string;
  detail: string;
};

const METRIC_LABELS: Record<string, string> = {
  SOIL_MOISTURE: "ความชื้นในดิน (%)",
  AIR_TEMP: "อุณหภูมิอากาศ (°C)",
  AIR_HUMIDITY: "ความชื้นสัมพัทธ์ในอากาศ (%RH)",
  SOIL_EC: "ความเค็มดิน EC (µS/cm)",
  SOIL_PH: "ความเป็นกรด-ด่างดิน (pH)",
  SOIL_TEMP: "อุณหภูมิดิน (°C)",
  OFFLINE_TIMEOUT: "สถานีขาดการเชื่อมต่อ (Offline)",
};

const OPERATOR_LABELS: Record<string, string> = {
  LESS_THAN: "ต่ำกว่าค่าที่กำหนด (<)",
  GREATER_THAN: "สูงกว่าค่าที่กำหนด (>)",
  OUT_OF_RANGE: "อยู่นอกช่วงปลอดภัย (< หรือ >)",
  OFFLINE_TIMEOUT: "ขาดสัญญาณเกินเวลาที่กำหนด",
};

export function AlertsManager() {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [farmId, setFarmId] = useState("");
  const [activeTab, setActiveTab] = useState<"events" | "rules" | "settings">("events");
  const [eventFilter, setEventFilter] = useState<"ALL" | AlertState>("ALL");

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<AlertMetricsSummary>({
    open_count: 0,
    acknowledged_count: 0,
    critical_count: 0,
    warning_count: 0,
    active_rules_count: 0,
  });

  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [preference, setPreference] = useState<NotificationPreference | null>(null);

  // Modals state
  const [showCreateRuleModal, setShowCreateRuleModal] = useState(false);
  const [showAckModal, setShowAckModal] = useState<AlertEvent | null>(null);
  const [showResolveModal, setShowResolveModal] = useState<AlertEvent | null>(null);

  const [ackNote, setAckNote] = useState("");
  const [resolveReason, setResolveReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state for creating rule
  const [ruleName, setRuleName] = useState("");
  const [ruleMetric, setRuleMetric] = useState("SOIL_MOISTURE");
  const [ruleOperator, setRuleOperator] = useState("LESS_THAN");
  const [thresholdMin, setThresholdMin] = useState("35.0");
  const [thresholdMax, setThresholdMax] = useState("");
  const [durationSeconds, setDurationSeconds] = useState("300");
  const [hysteresis, setHysteresis] = useState("2.0");
  const [ruleSeverity, setRuleSeverity] = useState<AlertSeverity>("WARNING");
  const [emailNotify, setEmailNotify] = useState(true);

  // Toasts
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const addToast = (type: "success" | "error", title: string, detail: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, title, detail }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  // Load initial farms
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
          addToast("error", "ผิดพลาด", "ไม่สามารถโหลดข้อมูลสวนได้");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch farm data
  const fetchData = useCallback(async () => {
    if (!farmId) return;
    try {
      const [sumRes, evtsRes, rulesRes, prefRes] = await Promise.all([
        apiFetch<AlertMetricsSummary>(`/farms/${farmId}/alerts/summary`).catch(() => ({
          open_count: 0,
          acknowledged_count: 0,
          critical_count: 0,
          warning_count: 0,
          active_rules_count: 0,
        })),
        apiFetch<AlertEvent[]>(`/farms/${farmId}/alerts/events`),
        apiFetch<AlertRule[]>(`/farms/${farmId}/alerts/rules`),
        apiFetch<NotificationPreference>("/notifications/preferences").catch(() => null),
      ]);
      setSummary(sumRes);
      setEvents(evtsRes);
      setRules(rulesRes);
      setPreference(prefRes);
    } catch {
      addToast("error", "ข้อผิดพลาด", "ไม่สามารถดึงข้อมูลการแจ้งเตือนได้");
    } finally {
      setLoading(false);
    }
  }, [farmId]);

  useEffect(() => {
    let cancelled = false;
    if (!farmId) return;

    Promise.all([
      apiFetch<AlertMetricsSummary>(`/farms/${farmId}/alerts/summary`).catch(() => ({
        open_count: 0,
        acknowledged_count: 0,
        critical_count: 0,
        warning_count: 0,
        active_rules_count: 0,
      })),
      apiFetch<AlertEvent[]>(`/farms/${farmId}/alerts/events`),
      apiFetch<AlertRule[]>(`/farms/${farmId}/alerts/rules`),
      apiFetch<NotificationPreference>("/notifications/preferences").catch(() => null),
    ])
      .then(([sumRes, evtsRes, rulesRes, prefRes]) => {
        if (cancelled) return;
        setSummary(sumRes);
        setEvents(evtsRes);
        setRules(rulesRes);
        setPreference(prefRes);
      })
      .catch(() => {
        if (!cancelled) {
          addToast("error", "ข้อผิดพลาด", "ไม่สามารถดึงข้อมูลการแจ้งเตือนได้");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [farmId]);

  // Create rule handler
  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName.trim()) {
      addToast("error", "กรอกข้อมูลไม่ครบ", "กรุณาระบุชื่อกฎแจ้งเตือน");
      return;
    }
    setIsSubmitting(true);
    try {
      const channels = ["IN_APP"];
      if (emailNotify) channels.push("EMAIL");

      await apiFetch(`/farms/${farmId}/alerts/rules`, {
        method: "POST",
        body: JSON.stringify({
          name: ruleName.trim(),
          metric_type: ruleMetric,
          operator: ruleOperator,
          threshold_min: thresholdMin ? parseFloat(thresholdMin) : null,
          threshold_max: thresholdMax ? parseFloat(thresholdMax) : null,
          duration_seconds: parseInt(durationSeconds, 10) || 0,
          hysteresis: parseFloat(hysteresis) || 0,
          severity: ruleSeverity,
          is_active: true,
          notify_channels: channels,
        }),
      });

      addToast("success", "สร้างกฎสำเร็จ", `กฎ "${ruleName}" พร้อมทำงานตรวจวัดแล้ว`);
      setShowCreateRuleModal(false);
      setRuleName("");
      fetchData();
    } catch {
      addToast("error", "ผิดพลาด", "ไม่สามารถสร้างกฎแจ้งเตือนได้");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle rule status
  const handleToggleRule = async (rule: AlertRule) => {
    try {
      await apiFetch(`/farms/${farmId}/alerts/rules/${rule.id}`, {
        method: "PUT",
        body: JSON.stringify({ is_active: !rule.is_active }),
      });
      addToast("success", "อัปเดตสถานะกฎ", `เปลี่ยนสถานะกฎเป็น ${!rule.is_active ? "เปิดใช้งาน" : "ปิดใช้งาน"}`);
      fetchData();
    } catch {
      addToast("error", "ผิดพลาด", "ไม่สามารถเปลี่ยนสถานะกฎได้");
    }
  };

  // Delete rule
  const handleDeleteRule = async (ruleId: string, ruleName: string) => {
    if (!window.confirm(`ยืนยันการลบกฎ "${ruleName}" หรือไม่?`)) return;
    try {
      await apiFetch(`/farms/${farmId}/alerts/rules/${ruleId}`, { method: "DELETE" });
      addToast("success", "ลบกฎสำเร็จ", `ลบกฎ "${ruleName}" เรียบร้อยแล้ว`);
      fetchData();
    } catch {
      addToast("error", "ผิดพลาด", "ไม่สามารถลบกฎแจ้งเตือนได้");
    }
  };

  // Acknowledge handler
  const handleAcknowledge = async () => {
    if (!showAckModal) return;
    setIsSubmitting(true);
    try {
      await apiFetch(`/farms/${farmId}/alerts/events/${showAckModal.id}/acknowledge`, {
        method: "POST",
        body: JSON.stringify({ note: ackNote.trim() || "รับทราบและกำลังดำเนินการแก้ไข" }),
      });
      addToast("success", "รับทราบเหตุการณ์", `บันทึกการรับทราบเหตุการณ์เรียบร้อยแล้ว`);
      setShowAckModal(null);
      setAckNote("");
      fetchData();
    } catch {
      addToast("error", "ผิดพลาด", "ไม่สามารถบันทึกรับทราบได้");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Resolve handler
  const handleResolve = async () => {
    if (!showResolveModal) return;
    setIsSubmitting(true);
    try {
      await apiFetch(`/farms/${farmId}/alerts/events/${showResolveModal.id}/resolve`, {
        method: "POST",
        body: JSON.stringify({ reason: resolveReason.trim() || "ตรวจสอบและแก้ไขปัญหาแล้ว" }),
      });
      addToast("success", "ปิดเหตุการณ์", `เหตุการณ์ได้รับการแก้ไขเรียบร้อยแล้ว`);
      setShowResolveModal(null);
      setResolveReason("");
      fetchData();
    } catch {
      addToast("error", "ผิดพลาด", "ไม่สามารถบันทึกแก้ไขได้");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Save Preferences
  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!preference) return;
    setIsSubmitting(true);
    try {
      const updated = await apiFetch<NotificationPreference>("/notifications/preferences", {
        method: "PUT",
        body: JSON.stringify({
          email_enabled: preference.email_enabled,
          in_app_enabled: preference.in_app_enabled,
          quiet_hours_start: preference.quiet_hours_start,
          quiet_hours_end: preference.quiet_hours_end,
          min_severity: preference.min_severity,
        }),
      });
      setPreference(updated);
      addToast("success", "บันทึกการตั้งค่า", "อัปเดตช่องทางการแจ้งเตือนเรียบร้อยแล้ว");
    } catch {
      addToast("error", "ผิดพลาด", "ไม่สามารถบันทึกการตั้งค่าได้");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredEvents = events.filter((e) => {
    if (eventFilter === "ALL") return true;
    return e.state === eventFilter;
  });

  return (
    <div className="telemetry-page" style={{ padding: "1.5rem", maxWidth: "1280px", margin: "0 auto" }}>
      {/* Header and Farm Selection */}
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <ShieldAlert size={28} color="#059669" />
            <h1 style={{ fontSize: "1.75rem", fontWeight: "700", color: "#111827", margin: 0 }}>
              ระบบกฎและการแจ้งเตือน (Alert Operations)
            </h1>
          </div>
          <p style={{ color: "#6b7280", margin: "0.25rem 0 0 0", fontSize: "0.95rem" }}>
            ตรวจจับความผิดปกติของสภาพอากาศและความชื้นดินในแปลงทุเรียน พร้อมแจ้งเตือนแบบเรียลไทม์
          </p>
        </div>

        {farms.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <label htmlFor="farm-select" style={{ fontSize: "0.9rem", fontWeight: 600, color: "#374151" }}>
              เลือกสวน:
            </label>
            <select
              id="farm-select"
              value={farmId}
              onChange={(e) => setFarmId(e.target.value)}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "8px",
                border: "1px solid #d1d5db",
                backgroundColor: "#fff",
                fontSize: "0.95rem",
                fontWeight: 600,
                color: "#111827",
                cursor: "pointer",
              }}
            >
              {farms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Summary KPI Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        <div style={{ background: "#fff", padding: "1.25rem", borderRadius: "12px", border: "1px solid #fee2e2", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.9rem", color: "#b91c1c", fontWeight: 600 }}>เหตุการณ์ที่เปิดอยู่ (Open)</span>
            <AlertCircle size={22} color="#dc2626" />
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 800, color: "#991b1b", marginTop: "0.5rem" }}>
            {summary.open_count}
          </div>
          <span style={{ fontSize: "0.8rem", color: "#ef4444" }}>ต้องการการตรวจสอบและแก้ไข</span>
        </div>

        <div style={{ background: "#fff", padding: "1.25rem", borderRadius: "12px", border: "1px solid #fef3c7", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.9rem", color: "#b45309", fontWeight: 600 }}>ระดับวิกฤต (Critical)</span>
            <AlertTriangle size={22} color="#d97706" />
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 800, color: "#b45309", marginTop: "0.5rem" }}>
            {summary.critical_count}
          </div>
          <span style={{ fontSize: "0.8rem", color: "#f59e0b" }}>กระทบต่อต้นทุเรียนโดยตรง</span>
        </div>

        <div style={{ background: "#fff", padding: "1.25rem", borderRadius: "12px", border: "1px solid #e0e7ff", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.9rem", color: "#4338ca", fontWeight: 600 }}>รับทราบแล้ว (Ack)</span>
            <Eye size={22} color="#4f46e5" />
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 800, color: "#3730a3", marginTop: "0.5rem" }}>
            {summary.acknowledged_count}
          </div>
          <span style={{ fontSize: "0.8rem", color: "#6366f1" }}>อยู่ระหว่างการลงแปลงตรวจสอบ</span>
        </div>

        <div style={{ background: "#fff", padding: "1.25rem", borderRadius: "12px", border: "1px solid #d1fae5", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.9rem", color: "#065f46", fontWeight: 600 }}>กฎที่ทำงานอยู่ (Active)</span>
            <Radio size={22} color="#059669" />
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 800, color: "#065f46", marginTop: "0.5rem" }}>
            {summary.active_rules_count}
          </div>
          <span style={{ fontSize: "0.8rem", color: "#10b981" }}>จากทั้งหมด {rules.length} กฎเกณฑ์</span>
        </div>
      </div>

      {/* Tabs Bar */}
      <div
        style={{
          display: "flex",
          borderBottom: "2px solid #e5e7eb",
          marginBottom: "1.5rem",
          gap: "1rem",
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab("events")}
          style={{
            padding: "0.75rem 1.25rem",
            fontSize: "1rem",
            fontWeight: 700,
            color: activeTab === "events" ? "#059669" : "#6b7280",
            borderBottom: activeTab === "events" ? "3px solid #059669" : "3px solid transparent",
            background: "none",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <Bell size={18} />
          บันทึกเหตุการณ์แจ้งเตือน ({events.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("rules")}
          style={{
            padding: "0.75rem 1.25rem",
            fontSize: "1rem",
            fontWeight: 700,
            color: activeTab === "rules" ? "#059669" : "#6b7280",
            borderBottom: activeTab === "rules" ? "3px solid #059669" : "3px solid transparent",
            background: "none",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <Settings size={18} />
          จัดการกฎการแจ้งเตือน ({rules.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("settings")}
          style={{
            padding: "0.75rem 1.25rem",
            fontSize: "1rem",
            fontWeight: 700,
            color: activeTab === "settings" ? "#059669" : "#6b7280",
            borderBottom: activeTab === "settings" ? "3px solid #059669" : "3px solid transparent",
            background: "none",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <Filter size={18} />
          ตั้งค่าช่องทางแจ้งเตือน
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "4rem 0", color: "#6b7280" }}>
          <LoaderCircle size={36} className="animate-spin" style={{ margin: "0 auto 1rem auto" }} />
          กำลังโหลดข้อมูลระบบแจ้งเตือน...
        </div>
      ) : activeTab === "events" ? (
        /* ==================== TAB 1: INCIDENTS LOG ==================== */
        <div>
          {/* Filters Bar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              {(["ALL", "OPEN", "ACKNOWLEDGED", "RESOLVED"] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setEventFilter(st)}
                  style={{
                    padding: "0.4rem 0.85rem",
                    borderRadius: "6px",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    border: "1px solid",
                    cursor: "pointer",
                    borderColor: eventFilter === st ? "#059669" : "#d1d5db",
                    backgroundColor: eventFilter === st ? "#ecfdf5" : "#fff",
                    color: eventFilter === st ? "#065f46" : "#4b5563",
                  }}
                >
                  {st === "ALL" && "ทั้งหมด"}
                  {st === "OPEN" && "🚨 เกิดขึ้นใหม่ (Open)"}
                  {st === "ACKNOWLEDGED" && "👀 กำลังตรวจสอบ (Ack)"}
                  {st === "RESOLVED" && "✅ แก้ไขแล้ว (Resolved)"}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={fetchData}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                padding: "0.4rem 0.85rem",
                borderRadius: "6px",
                border: "1px solid #d1d5db",
                background: "#fff",
                fontSize: "0.85rem",
                cursor: "pointer",
                color: "#374151",
              }}
            >
              รีเฟรชข้อมูล
            </button>
          </div>

          {filteredEvents.length === 0 ? (
            <div style={{ textAlign: "center", padding: "4rem 0", background: "#f9fafb", borderRadius: "12px", border: "1px dashed #d1d5db" }}>
              <CheckCircle2 size={42} color="#10b981" style={{ margin: "0 auto 0.75rem auto" }} />
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#111827", margin: 0 }}>ไม่มีเหตุการณ์แจ้งเตือน</h3>
              <p style={{ color: "#6b7280", margin: "0.25rem 0 0 0", fontSize: "0.9rem" }}>
                ระบบตรวจวัดและสภาพแปลงทุเรียนทั้งหมดอยู่ในเกณฑ์ปกติ
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {filteredEvents.map((evt) => {
                const isCrit = evt.severity === "CRITICAL";
                const isWarn = evt.severity === "WARNING";
                const borderColor = isCrit ? "#fca5a5" : isWarn ? "#fcd34d" : "#bfdbfe";
                const badgeBg = isCrit ? "#fee2e2" : isWarn ? "#fef3c7" : "#dbeafe";
                const badgeColor = isCrit ? "#991b1b" : isWarn ? "#92400e" : "#1e40af";

                return (
                  <div
                    key={evt.id}
                    style={{
                      background: "#fff",
                      border: `1px solid ${borderColor}`,
                      borderLeft: `5px solid ${isCrit ? "#dc2626" : isWarn ? "#d97706" : "#2563eb"}`,
                      borderRadius: "8px",
                      padding: "1rem 1.25rem",
                      display: "flex",
                      flexWrap: "wrap",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "1rem",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                    }}
                  >
                    <div style={{ flex: "1 1 300px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem" }}>
                        <span
                          style={{
                            background: badgeBg,
                            color: badgeColor,
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            padding: "0.2rem 0.5rem",
                            borderRadius: "4px",
                          }}
                        >
                          {evt.severity}
                        </span>

                        <span
                          style={{
                            fontSize: "0.8rem",
                            fontWeight: 600,
                            padding: "0.2rem 0.5rem",
                            borderRadius: "4px",
                            background: evt.state === "OPEN" ? "#fef2f2" : evt.state === "ACKNOWLEDGED" ? "#fffbeb" : "#f0fdf4",
                            color: evt.state === "OPEN" ? "#b91c1c" : evt.state === "ACKNOWLEDGED" ? "#b45309" : "#15803d",
                          }}
                        >
                          {evt.state === "OPEN" && "🚨 รอตรวจสอบ (Open)"}
                          {evt.state === "ACKNOWLEDGED" && "👀 รับทราบแล้ว"}
                          {evt.state === "RESOLVED" && "✅ แก้ไขแล้ว"}
                        </span>

                        <span style={{ fontSize: "0.8rem", color: "#6b7280", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                          <Clock size={14} />
                          {new Date(evt.created_at).toLocaleString("th-TH")}
                        </span>
                      </div>

                      <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#111827", margin: "0 0 0.25rem 0" }}>
                        {evt.title}
                      </h3>
                      <p style={{ fontSize: "0.9rem", color: "#4b5563", margin: 0 }}>
                        {evt.message}
                      </p>

                      {evt.acknowledge_note && (
                        <div style={{ marginTop: "0.5rem", background: "#f9fafb", padding: "0.4rem 0.75rem", borderRadius: "6px", fontSize: "0.85rem", color: "#374151" }}>
                          <strong>บันทึกรับทราบ:</strong> {evt.acknowledge_note}
                          {evt.acknowledged_by_name && ` (โดย ${evt.acknowledged_by_name})`}
                        </div>
                      )}

                      {evt.resolve_reason && (
                        <div style={{ marginTop: "0.5rem", background: "#f0fdf4", padding: "0.4rem 0.75rem", borderRadius: "6px", fontSize: "0.85rem", color: "#166534" }}>
                          <strong>การแก้ไข:</strong> {evt.resolve_reason}
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      {evt.state === "OPEN" && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowAckModal(evt);
                            setAckNote("");
                          }}
                          style={{
                            padding: "0.45rem 0.9rem",
                            borderRadius: "6px",
                            border: "1px solid #d97706",
                            background: "#fffbeb",
                            color: "#b45309",
                            fontSize: "0.85rem",
                            fontWeight: 700,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.35rem",
                          }}
                        >
                          <Eye size={16} />
                          รับทราบ (Acknowledge)
                        </button>
                      )}

                      {evt.state !== "RESOLVED" && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowResolveModal(evt);
                            setResolveReason("");
                          }}
                          style={{
                            padding: "0.45rem 0.9rem",
                            borderRadius: "6px",
                            border: "none",
                            background: "#059669",
                            color: "#fff",
                            fontSize: "0.85rem",
                            fontWeight: 700,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.35rem",
                          }}
                        >
                          <Check size={16} />
                          แก้ไขแล้ว (Resolve)
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : activeTab === "rules" ? (
        /* ==================== TAB 2: ALERT RULES MANAGER ==================== */
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#111827", margin: 0 }}>
              รายการกฎการแจ้งเตือนทั้งหมด ({rules.length})
            </h2>

            <button
              type="button"
              onClick={() => setShowCreateRuleModal(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                padding: "0.55rem 1.1rem",
                background: "#059669",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                fontWeight: 700,
                fontSize: "0.9rem",
                cursor: "pointer",
              }}
            >
              <Plus size={18} />
              + สร้างกฎแจ้งเตือนใหม่
            </button>
          </div>

          {rules.length === 0 ? (
            <div style={{ textAlign: "center", padding: "4rem 0", background: "#f9fafb", borderRadius: "12px", border: "1px dashed #d1d5db" }}>
              <ShieldAlert size={42} color="#9ca3af" style={{ margin: "0 auto 0.75rem auto" }} />
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#111827", margin: 0 }}>ยังไม่มีการตั้งกฎแจ้งเตือน</h3>
              <p style={{ color: "#6b7280", margin: "0.25rem 0 1rem 0", fontSize: "0.9rem" }}>
                กดปุ่มด้านบนเพื่อสร้างกฎเตือนความชื้นดินหรืออุณหภูมิสำหรับแปลงทุเรียน
              </p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "1rem" }}>
              {rules.map((rule) => {
                const isCrit = rule.severity === "CRITICAL";
                const isWarn = rule.severity === "WARNING";

                return (
                  <div
                    key={rule.id}
                    style={{
                      background: "#fff",
                      border: "1px solid #e5e7eb",
                      borderRadius: "10px",
                      padding: "1.25rem",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                        <span
                          style={{
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            padding: "0.2rem 0.5rem",
                            borderRadius: "4px",
                            background: isCrit ? "#fee2e2" : isWarn ? "#fef3c7" : "#dbeafe",
                            color: isCrit ? "#991b1b" : isWarn ? "#92400e" : "#1e40af",
                          }}
                        >
                          {rule.severity}
                        </span>

                        <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", cursor: "pointer", fontSize: "0.85rem", fontWeight: 600 }}>
                          <input
                            type="checkbox"
                            checked={rule.is_active}
                            onChange={() => handleToggleRule(rule)}
                            style={{ width: "16px", height: "16px", cursor: "pointer" }}
                          />
                          <span style={{ color: rule.is_active ? "#059669" : "#9ca3af" }}>
                            {rule.is_active ? "เปิดทำงาน" : "ปิดใช้งาน"}
                          </span>
                        </label>
                      </div>

                      <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#111827", margin: "0 0 0.4rem 0" }}>
                        {rule.name}
                      </h3>

                      <div style={{ fontSize: "0.85rem", color: "#4b5563", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                        <div>
                          <strong>ตัวแปรตรวจวัด:</strong> {METRIC_LABELS[rule.metric_type] || rule.metric_type}
                        </div>
                        <div>
                          <strong>เงื่อนไข:</strong> {OPERATOR_LABELS[rule.operator] || rule.operator}
                        </div>
                        <div>
                          <strong>ค่าเกณฑ์:</strong>{" "}
                          {rule.operator === "LESS_THAN" && `< ${rule.threshold_min}`}
                          {rule.operator === "GREATER_THAN" && `> ${rule.threshold_max}`}
                          {rule.operator === "OUT_OF_RANGE" && `< ${rule.threshold_min} หรือ > ${rule.threshold_max}`}
                          {rule.operator === "OFFLINE_TIMEOUT" && `ขาดการส่งเกิน ${rule.duration_seconds} วินาที`}
                        </div>
                        <div>
                          <strong>Hysteresis / กันแกว่ง:</strong> ±{rule.hysteresis}
                        </div>
                      </div>
                    </div>

                    <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: "0.75rem", marginTop: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "0.75rem", color: "#9ca3af" }}>
                        ช่องทาง: {rule.notify_channels.join(", ")}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleDeleteRule(rule.id, rule.name)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#ef4444",
                          cursor: "pointer",
                          padding: "0.25rem",
                          borderRadius: "4px",
                        }}
                        title="ลบกฎนี้"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ==================== TAB 3: NOTIFICATION SETTINGS ==================== */
        <div style={{ maxWidth: "640px", background: "#fff", padding: "1.5rem", borderRadius: "12px", border: "1px solid #e5e7eb" }}>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#111827", marginBottom: "1rem" }}>
            การตั้งค่าการรับการแจ้งเตือน (Notification Preferences)
          </h2>

          {preference && (
            <form onSubmit={handleSavePreferences} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer", fontSize: "0.95rem" }}>
                  <input
                    type="checkbox"
                    checked={preference.in_app_enabled}
                    onChange={(e) => setPreference({ ...preference, in_app_enabled: e.target.checked })}
                    style={{ width: "18px", height: "18px" }}
                  />
                  <span><strong>การแจ้งเตือนในระบบ (In-App Bell & Drawer)</strong> — แสดงตัวเลขกระดิ่งและกล่องแจ้งเตือนบนหน้าจอ</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer", fontSize: "0.95rem" }}>
                  <input
                    type="checkbox"
                    checked={preference.email_enabled}
                    onChange={(e) => setPreference({ ...preference, email_enabled: e.target.checked })}
                    style={{ width: "18px", height: "18px" }}
                  />
                  <span><strong>ส่งอีเมลแจ้งเตือน (Email Notification)</strong> — ส่งแจ้งเตือนฉุกเฉินไปยังอีเมลประจำบัญชี</span>
                </label>
              </div>

              <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "1rem" }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "#111827", marginBottom: "0.5rem" }}>
                  ระดับความรุนแรงขั้นต่ำที่ต้องการรับเตือน (Minimum Severity)
                </h3>
                <select
                  value={preference.min_severity}
                  onChange={(e) => setPreference({ ...preference, min_severity: e.target.value as AlertSeverity })}
                  style={{
                    padding: "0.5rem",
                    borderRadius: "6px",
                    border: "1px solid #d1d5db",
                    width: "100%",
                    fontSize: "0.95rem",
                  }}
                >
                  <option value="INFO">INFO — แจ้งเตือนทุกระดับ (ข้อมูลทั่วไป, เตือน, วิกฤต)</option>
                  <option value="WARNING">WARNING — เฉพาะการแจ้งเตือนและการผิดปกติขั้นวิกฤต</option>
                  <option value="CRITICAL">CRITICAL — เฉพาะเหตุการณ์วิกฤตเท่านั้น</option>
                </select>
              </div>

              <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "1rem" }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "#111827", marginBottom: "0.5rem" }}>
                  ช่วงเวลาห้ามรบกวน (Quiet Hours)
                </h3>
                <p style={{ fontSize: "0.85rem", color: "#6b7280", margin: "0 0 0.75rem 0" }}>
                  ระบบจะไม่ส่งเสียงแจ้งเตือนหรือส่งอีเมลในช่วงเวลานี้ (ยกเว้นเหตุการณ์ระดับ CRITICAL)
                </p>
                <div style={{ display: "flex", gap: "1rem" }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: "block", fontSize: "0.85rem", color: "#4b5563", marginBottom: "0.25rem" }}>
                      ตั้งแต่เวลา:
                    </label>
                    <input
                      type="time"
                      value={preference.quiet_hours_start || ""}
                      onChange={(e) => setPreference({ ...preference, quiet_hours_start: e.target.value || null })}
                      style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #d1d5db" }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: "block", fontSize: "0.85rem", color: "#4b5563", marginBottom: "0.25rem" }}>
                      ถึงเวลา:
                    </label>
                    <input
                      type="time"
                      value={preference.quiet_hours_end || ""}
                      onChange={(e) => setPreference({ ...preference, quiet_hours_end: e.target.value || null })}
                      style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #d1d5db" }}
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  padding: "0.75rem",
                  background: "#059669",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  fontWeight: 700,
                  fontSize: "1rem",
                  cursor: isSubmitting ? "not-allowed" : "pointer",
                  marginTop: "0.5rem",
                }}
              >
                {isSubmitting ? "กำลังบันทึก..." : "บันทึกการตั้งค่า"}
              </button>
            </form>
          )}
        </div>
      )}

      {/* ==================== CREATE RULE MODAL ==================== */}
      {showCreateRuleModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 999,
            padding: "1rem",
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "12px",
              maxWidth: "560px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "1.5rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0, color: "#111827" }}>
                สร้างกฎการแจ้งเตือนใหม่ (Create Alert Rule)
              </h2>
              <button
                type="button"
                onClick={() => setShowCreateRuleModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280" }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateRule} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 600, color: "#374151", marginBottom: "0.25rem" }}>
                  ชื่อกฎแจ้งเตือน *
                </label>
                <input
                  type="text"
                  placeholder="เช่น ความชื้นดินต่ำเกินไป (แปลงโซน 1)"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  required
                  style={{ width: "100%", padding: "0.55rem", borderRadius: "6px", border: "1px solid #d1d5db" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 600, color: "#374151", marginBottom: "0.25rem" }}>
                    ตัวแปรตรวจวัด
                  </label>
                  <select
                    value={ruleMetric}
                    onChange={(e) => setRuleMetric(e.target.value)}
                    style={{ width: "100%", padding: "0.55rem", borderRadius: "6px", border: "1px solid #d1d5db" }}
                  >
                    <option value="SOIL_MOISTURE">ความชื้นดิน (%)</option>
                    <option value="AIR_TEMP">อุณหภูมิอากาศ (°C)</option>
                    <option value="AIR_HUMIDITY">ความชื้นในอากาศ (%RH)</option>
                    <option value="SOIL_EC">ค่าความเค็ม EC (µS/cm)</option>
                    <option value="SOIL_PH">ค่ากรดด่าง pH</option>
                    <option value="OFFLINE_TIMEOUT">สถานีออฟไลน์ (Offline)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 600, color: "#374151", marginBottom: "0.25rem" }}>
                    เงื่อนไข (Operator)
                  </label>
                  <select
                    value={ruleOperator}
                    onChange={(e) => setRuleOperator(e.target.value)}
                    style={{ width: "100%", padding: "0.55rem", borderRadius: "6px", border: "1px solid #d1d5db" }}
                  >
                    <option value="LESS_THAN">ต่ำกว่าค่าที่กำหนด (&lt;)</option>
                    <option value="GREATER_THAN">สูงกว่าค่าที่กำหนด (&gt;)</option>
                    <option value="OUT_OF_RANGE">อยู่นอกช่วงปลอดภัย</option>
                    <option value="OFFLINE_TIMEOUT">ขาดสัญญาณตามเวลา</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 600, color: "#374151", marginBottom: "0.25rem" }}>
                    ค่าต่ำสุด (Min Threshold)
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="เช่น 30.0"
                    value={thresholdMin}
                    onChange={(e) => setThresholdMin(e.target.value)}
                    style={{ width: "100%", padding: "0.55rem", borderRadius: "6px", border: "1px solid #d1d5db" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 600, color: "#374151", marginBottom: "0.25rem" }}>
                    ค่าสูงสุด (Max Threshold)
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="เช่น 45.0"
                    value={thresholdMax}
                    onChange={(e) => setThresholdMax(e.target.value)}
                    style={{ width: "100%", padding: "0.55rem", borderRadius: "6px", border: "1px solid #d1d5db" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 600, color: "#374151", marginBottom: "0.25rem" }}>
                    หน่วงเวลาตรวจจับ (วินาที)
                  </label>
                  <input
                    type="number"
                    value={durationSeconds}
                    onChange={(e) => setDurationSeconds(e.target.value)}
                    placeholder="300"
                    style={{ width: "100%", padding: "0.55rem", borderRadius: "6px", border: "1px solid #d1d5db" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 600, color: "#374151", marginBottom: "0.25rem" }}>
                    Hysteresis (กันแกว่ง)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={hysteresis}
                    onChange={(e) => setHysteresis(e.target.value)}
                    placeholder="2.0"
                    style={{ width: "100%", padding: "0.55rem", borderRadius: "6px", border: "1px solid #d1d5db" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 600, color: "#374151", marginBottom: "0.25rem" }}>
                    ระดับความรุนแรง (Severity)
                  </label>
                  <select
                    value={ruleSeverity}
                    onChange={(e) => setRuleSeverity(e.target.value as AlertSeverity)}
                    style={{ width: "100%", padding: "0.55rem", borderRadius: "6px", border: "1px solid #d1d5db" }}
                  >
                    <option value="INFO">INFO (ข้อมูล)</option>
                    <option value="WARNING">WARNING (เตือน)</option>
                    <option value="CRITICAL">CRITICAL (วิกฤต)</option>
                  </select>
                </div>

                <div style={{ display: "flex", alignItems: "center", paddingTop: "1.25rem" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "0.9rem" }}>
                    <input
                      type="checkbox"
                      checked={emailNotify}
                      onChange={(e) => setEmailNotify(e.target.checked)}
                      style={{ width: "16px", height: "16px" }}
                    />
                    <span>ส่งอีเมลแจ้งเตือนด้วย</span>
                  </label>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1rem" }}>
                <button
                  type="button"
                  onClick={() => setShowCreateRuleModal(false)}
                  style={{
                    padding: "0.55rem 1rem",
                    borderRadius: "6px",
                    border: "1px solid #d1d5db",
                    background: "#fff",
                    color: "#374151",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    padding: "0.55rem 1.25rem",
                    borderRadius: "6px",
                    border: "none",
                    background: "#059669",
                    color: "#fff",
                    fontWeight: 700,
                    cursor: isSubmitting ? "not-allowed" : "pointer",
                  }}
                >
                  {isSubmitting ? "กำลังบันทึก..." : "บันทึกกฎ"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== ACKNOWLEDGE MODAL ==================== */}
      {showAckModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 999,
            padding: "1rem",
          }}
        >
          <div style={{ background: "#fff", borderRadius: "12px", maxWidth: "480px", width: "100%", padding: "1.5rem" }}>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0 0 0.5rem 0", color: "#111827" }}>
              รับทราบเหตุการณ์แจ้งเตือน (Acknowledge)
            </h2>
            <p style={{ fontSize: "0.9rem", color: "#4b5563", margin: "0 0 1rem 0" }}>
              {showAckModal.title} — {showAckModal.message}
            </p>

            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#374151", marginBottom: "0.25rem" }}>
                หมายเหตุการตรวจสอบหน้างาน:
              </label>
              <textarea
                rows={3}
                placeholder="เช่น ทราบแล้ว กำลังเดินไปเปิดวาล์วน้ำโซน 1..."
                value={ackNote}
                onChange={(e) => setAckNote(e.target.value)}
                style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #d1d5db" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button
                type="button"
                onClick={() => setShowAckModal(null)}
                style={{ padding: "0.5rem 1rem", borderRadius: "6px", border: "1px solid #d1d5db", background: "#fff", cursor: "pointer" }}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleAcknowledge}
                disabled={isSubmitting}
                style={{ padding: "0.5rem 1.2rem", borderRadius: "6px", border: "none", background: "#d97706", color: "#fff", fontWeight: 700, cursor: "pointer" }}
              >
                {isSubmitting ? "กำลังบันทึก..." : "ยืนยันรับทราบ"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== RESOLVE MODAL ==================== */}
      {showResolveModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 999,
            padding: "1rem",
          }}
        >
          <div style={{ background: "#fff", borderRadius: "12px", maxWidth: "480px", width: "100%", padding: "1.5rem" }}>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0 0 0.5rem 0", color: "#111827" }}>
              ปิดเหตุการณ์ / แก้ไขแล้ว (Resolve)
            </h2>
            <p style={{ fontSize: "0.9rem", color: "#4b5563", margin: "0 0 1rem 0" }}>
              {showResolveModal.title}
            </p>

            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#374151", marginBottom: "0.25rem" }}>
                รายละเอียดการแก้ไขปัญหา:
              </label>
              <input
                type="text"
                placeholder="เช่น เปิดปั๊มน้ำรดแปลง 30 นาที ค่าความชื้นกลับสู่เกณฑ์ปกติแล้ว"
                value={resolveReason}
                onChange={(e) => setResolveReason(e.target.value)}
                style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #d1d5db" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button
                type="button"
                onClick={() => setShowResolveModal(null)}
                style={{ padding: "0.5rem 1rem", borderRadius: "6px", border: "1px solid #d1d5db", background: "#fff", cursor: "pointer" }}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleResolve}
                disabled={isSubmitting}
                style={{ padding: "0.5rem 1.2rem", borderRadius: "6px", border: "none", background: "#059669", color: "#fff", fontWeight: 700, cursor: "pointer" }}
              >
                {isSubmitting ? "กำลังบันทึก..." : "ยืนยันปิดเหตุการณ์"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      <div
        style={{
          position: "fixed",
          bottom: "1.5rem",
          right: "1.5rem",
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
        }}
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            style={{
              background: toast.type === "success" ? "#065f46" : "#991b1b",
              color: "#fff",
              padding: "0.75rem 1rem",
              borderRadius: "8px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              minWidth: "260px",
            }}
          >
            {toast.type === "success" ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: "0.85rem" }}>{toast.title}</div>
              <div style={{ fontSize: "0.8rem", opacity: 0.9 }}>{toast.detail}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
