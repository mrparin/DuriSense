"use client";

import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Battery,
  CheckCircle2,
  Cpu,
  Download,
  Eye,
  Layers,
  LoaderCircle,
  Radio,
  RefreshCw,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

export type Farm = { id: string; name: string };

export type StationHealthSummary = {
  station_id: string;
  station_code: string;
  display_name: string;
  plot_id: string | null;
  plot_name: string | null;
  status: string; // "ONLINE" | "DEGRADED" | "OFFLINE"
  battery_pct: number | null;
  battery_status: string; // "GOOD" | "FAIR" | "LOW" | "CRITICAL" | "UNKNOWN"
  rssi_dbm: number | null;
  signal_quality: string; // "EXCELLENT" | "GOOD" | "FAIR" | "POOR" | "UNKNOWN"
  last_seen: string | null;
  assigned_sensor_count: number;
};

export type SensorHealthSummary = {
  sensor_id: string;
  sensor_code: string;
  display_name: string;
  sensor_type: string;
  plot_id: string | null;
  plot_name: string | null;
  status: string;
  last_seen: string | null;
};

export type FarmHealthSummary = {
  farm_id: string;
  total_stations: number;
  total_sensors: number;
  online_stations: number;
  degraded_stations: number;
  offline_stations: number;
  low_battery_count: number;
  weak_signal_count: number;
  stations: StationHealthSummary[];
  sensors: SensorHealthSummary[];
};

export type DeviceHealthHistoryItem = {
  recorded_at: string;
  battery_pct: number | null;
  battery_voltage: number | null;
  rssi_dbm: number | null;
  status: string;
  uptime_seconds: number | null;
};

export type DeviceHealthDetail = {
  device_id: string;
  device_code: string;
  display_name: string;
  kind: string;
  plot_id: string | null;
  plot_name: string | null;
  status: string;
  battery_pct: number | null;
  battery_voltage: number | null;
  battery_status: string;
  rssi_dbm: number | null;
  signal_quality: string;
  uptime_seconds: number | null;
  uptime_formatted: string | null;
  firmware_version: string | null;
  last_seen: string | null;
  offline_duration_seconds: number | null;
  recent_history: DeviceHealthHistoryItem[];
};

export type DataGapItem = {
  id: string;
  station_id: string;
  station_code: string;
  station_name: string;
  plot_name: string | null;
  gap_start: string;
  gap_end: string;
  duration_seconds: number;
  duration_formatted: string;
  severity: "MINOR" | "MODERATE" | "CRITICAL";
  probable_cause: string;
};

export type StationGapSummary = {
  station_id: string;
  station_code: string;
  station_name: string;
  total_gaps: number;
  total_gap_seconds: number;
  completeness_pct: number;
};

export type DataGapReport = {
  farm_id: string;
  start_date: string;
  end_date: string;
  threshold_minutes: number;
  total_gaps_count: number;
  total_gap_duration_seconds: number;
  overall_completeness_pct: number;
  gaps: DataGapItem[];
  stations_summary: StationGapSummary[];
};

export type OfflineCheckResult = {
  checked_at: string;
  total_devices_checked: number;
  offline_devices_count: number;
  offline_device_codes: string[];
  alerts_triggered: number;
};

export function DeviceHealthCenter({
  farms,
  selectedFarmId,
  onFarmChange,
  onSwitchToRegistry,
}: {
  farms: Farm[];
  selectedFarmId: string;
  onFarmChange: (id: string) => void;
  onSwitchToRegistry?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"health" | "gaps">("health");
  const [summary, setSummary] = useState<FarmHealthSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Offline check action
  const [checkingOffline, setCheckingOffline] = useState(false);

  // Health Detail Modal
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [healthDetail, setHealthDetail] = useState<DeviceHealthDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Data Gap Report state
  const [timeRangeHours, setTimeRangeHours] = useState<number>(24);
  const [thresholdMinutes, setThresholdMinutes] = useState<number>(30);
  const [filterStationId, setFilterStationId] = useState<string>("ALL");
  const [gapReport, setGapReport] = useState<DataGapReport | null>(null);
  const [gapsLoading, setGapsLoading] = useState(false);

  // Load Farm Health Summary on farm change
  useEffect(() => {
    if (!selectedFarmId) return;
    let cancelled = false;
    apiFetch<FarmHealthSummary>(`/farms/${selectedFarmId}/health/summary`)
      .then((data) => {
        if (!cancelled) {
          setSummary(data);
          setError("");
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("ไม่สามารถโหลดข้อมูลสรุปสุขภาพอุปกรณ์ได้");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedFarmId]);

  // Load Data Gap Report on tab or filter change
  useEffect(() => {
    if (!selectedFarmId || activeTab !== "gaps") return;
    let cancelled = false;
    const now = new Date();
    const start = new Date(now.getTime() - timeRangeHours * 3600 * 1000);
    const url = `/farms/${selectedFarmId}/health/data-gaps?start_date=${encodeURIComponent(
      start.toISOString()
    )}&end_date=${encodeURIComponent(now.toISOString())}&threshold_minutes=${thresholdMinutes}${
      filterStationId !== "ALL" ? `&station_id=${filterStationId}` : ""
    }`;
    apiFetch<DataGapReport>(url)
      .then((data) => {
        if (!cancelled) {
          setGapReport(data);
          setGapsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("ไม่สามารถโหลดรายงานข้อมูลขาดช่วงได้");
          setGapsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedFarmId, activeTab, timeRangeHours, thresholdMinutes, filterStationId]);

  const refreshAll = useCallback(() => {
    if (!selectedFarmId) return;
    setLoading(true);
    apiFetch<FarmHealthSummary>(`/farms/${selectedFarmId}/health/summary`)
      .then((data) => {
        setSummary(data);
        setError("");
      })
      .catch(() => setError("ไม่สามารถโหลดข้อมูลสรุปสุขภาพอุปกรณ์ได้"))
      .finally(() => setLoading(false));

    if (activeTab === "gaps") {
      setGapsLoading(true);
      const now = new Date();
      const start = new Date(now.getTime() - timeRangeHours * 3600 * 1000);
      const url = `/farms/${selectedFarmId}/health/data-gaps?start_date=${encodeURIComponent(
        start.toISOString()
      )}&end_date=${encodeURIComponent(now.toISOString())}&threshold_minutes=${thresholdMinutes}${
        filterStationId !== "ALL" ? `&station_id=${filterStationId}` : ""
      }`;
      apiFetch<DataGapReport>(url)
        .then((data) => setGapReport(data))
        .catch(() => setError("ไม่สามารถโหลดรายงานข้อมูลขาดช่วงได้"))
        .finally(() => setGapsLoading(false));
    }
  }, [selectedFarmId, activeTab, timeRangeHours, thresholdMinutes, filterStationId]);

  // Open Health Detail Modal
  async function openHealthDetail(stationId: string) {
    setSelectedStationId(stationId);
    setDetailLoading(true);
    setHealthDetail(null);
    try {
      const data = await apiFetch<DeviceHealthDetail>(`/devices/${stationId}/health/detail`);
      setHealthDetail(data);
    } catch {
      setError("ไม่สามารถโหลดรายละเอียดสุขภาพอุปกรณ์ได้");
    } finally {
      setDetailLoading(false);
    }
  }

  // Trigger manual offline check
  async function runOfflineCheck() {
    if (!selectedFarmId) return;
    setCheckingOffline(true);
    try {
      const res = await apiFetch<OfflineCheckResult>(
        `/farms/${selectedFarmId}/health/check-offline?timeout_seconds=3600`,
        { method: "POST" }
      );
      setNotice(
        `ตรวจสอบสถานะอุปกรณ์ ${res.total_devices_checked} ตัวเรียบร้อย: พบออฟไลน์ ${res.offline_devices_count} ตัว, สร้างแจ้งเตือนใหม่ ${res.alerts_triggered} รายการ`
      );
      await loadHealthSummary();
    } catch {
      setError("เกิดข้อผิดพลาดในการตรวจสอบสถานะออฟไลน์");
    } finally {
      setCheckingOffline(false);
    }
  }

  // Export Data Gap Report to CSV
  function exportGapsCsv() {
    if (!gapReport || gapReport.gaps.length === 0) return;
    const headers = [
      "ID",
      "Station Code",
      "Station Name",
      "Plot",
      "Gap Start (UTC)",
      "Gap End (UTC)",
      "Duration (Seconds)",
      "Duration",
      "Severity",
      "Probable Cause",
    ];
    const rows = gapReport.gaps.map((g) => [
      g.id,
      g.station_code,
      `"${g.station_name.replace(/"/g, '""')}"`,
      `"${(g.plot_name || "-").replace(/"/g, '""')}"`,
      g.gap_start,
      g.gap_end,
      g.duration_seconds,
      `"${g.duration_formatted}"`,
      g.severity,
      `"${g.probable_cause.replace(/"/g, '""')}"`,
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `durisense-data-gaps-${selectedFarmId}-${timeRangeHours}h.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const selectedFarmName = farms.find((f) => f.id === selectedFarmId)?.name || "สวนทุเรียน";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Header & Controls */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                color: "var(--brand-700)",
                background: "var(--brand-100)",
                padding: "2px 8px",
                borderRadius: "4px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Phase 2B: Device Health & Data Gap
            </span>
          </div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>
            สุขภาพอุปกรณ์ & สัญญาณขาดช่วง
          </h1>
          <p style={{ fontSize: "0.95rem", color: "var(--text-secondary)", margin: "0.25rem 0 0" }}>
            ตรวจสอบการเชื่อมต่อ แบตเตอรี่ ระดับสัญญาณ RSSI และตรวจจับช่องว่างเวลาข้อมูลเซนเซอร์ขาดหาย — {selectedFarmName}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          {/* Farm selector */}
          {farms.length > 1 && (
            <select
              value={selectedFarmId}
              onChange={(e) => onFarmChange(e.target.value)}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "8px",
                border: "1px solid var(--border-subtle)",
                background: "var(--surface-card)",
                color: "var(--text-primary)",
                fontWeight: 600,
                fontSize: "0.9rem",
              }}
            >
              {farms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          )}

          {/* Offline check button */}
          <button
            onClick={runOfflineCheck}
            disabled={checkingOffline}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.5rem 1rem",
              borderRadius: "8px",
              border: "1px solid #f59e0b",
              background: "#fef3c7",
              color: "#92400e",
              fontWeight: 700,
              fontSize: "0.9rem",
              cursor: checkingOffline ? "wait" : "pointer",
              transition: "all 0.15s ease",
            }}
          >
            {checkingOffline ? (
              <LoaderCircle style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} />
            ) : (
              <Radio style={{ width: 16, height: 16 }} />
            )}
            ตรวจสถานะออฟไลน์ทันที
          </button>

          {/* Switch to Registry button if provided */}
          {onSwitchToRegistry && (
            <button
              onClick={onSwitchToRegistry}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.5rem 1rem",
                borderRadius: "8px",
                border: "1px solid var(--border-subtle)",
                background: "var(--surface-card)",
                color: "var(--text-primary)",
                fontWeight: 600,
                fontSize: "0.9rem",
                cursor: "pointer",
              }}
            >
              <Cpu style={{ width: 16, height: 16 }} />
              จัดการทะเบียนอุปกรณ์
            </button>
          )}

          {/* Refresh button */}
          <button
            onClick={refreshAll}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 38,
              height: 38,
              borderRadius: "8px",
              border: "1px solid var(--border-subtle)",
              background: "var(--surface-card)",
              cursor: "pointer",
            }}
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw style={{ width: 16, height: 16, color: "var(--text-secondary)" }} />
          </button>
        </div>
      </div>

      {/* Notices & Alerts */}
      {notice && (
        <div
          style={{
            padding: "0.75rem 1rem",
            borderRadius: "8px",
            background: "#dcfce7",
            border: "1px solid #86efac",
            color: "#166534",
            fontSize: "0.9rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <CheckCircle2 style={{ width: 18, height: 18 }} />
            <span>{notice}</span>
          </div>
          <button
            onClick={() => setNotice("")}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#166534" }}
          >
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>
      )}

      {error && (
        <div
          style={{
            padding: "0.75rem 1rem",
            borderRadius: "8px",
            background: "#fee2e2",
            border: "1px solid #fca5a5",
            color: "#991b1b",
            fontSize: "0.9rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <AlertCircle style={{ width: 18, height: 18 }} />
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError("")}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#991b1b" }}
          >
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>
      )}

      {/* Primary Tabs */}
      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          borderBottom: "1px solid var(--border-subtle)",
          paddingBottom: "0.5rem",
        }}
      >
        <button
          onClick={() => setActiveTab("health")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.6rem 1.25rem",
            borderRadius: "8px",
            border: "none",
            fontWeight: 700,
            fontSize: "0.95rem",
            cursor: "pointer",
            background: activeTab === "health" ? "var(--brand-600)" : "transparent",
            color: activeTab === "health" ? "#ffffff" : "var(--text-secondary)",
            transition: "all 0.15s ease",
          }}
        >
          <Activity style={{ width: 18, height: 18 }} />
          สุขภาพอุปกรณ์และระดับสัญญาณ
        </button>

        <button
          onClick={() => setActiveTab("gaps")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.6rem 1.25rem",
            borderRadius: "8px",
            border: "none",
            fontWeight: 700,
            fontSize: "0.95rem",
            cursor: "pointer",
            background: activeTab === "gaps" ? "var(--brand-600)" : "transparent",
            color: activeTab === "gaps" ? "#ffffff" : "var(--text-secondary)",
            transition: "all 0.15s ease",
          }}
        >
          <WifiOff style={{ width: 18, height: 18 }} />
          รายงานสัญญาณและข้อมูลขาดช่วง (Data Gap)
        </button>
      </div>

      {/* Tab 1: Device Health & Signal */}
      {activeTab === "health" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* KPI Summary Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "1rem",
            }}
          >
            {/* Online Stations */}
            <div
              style={{
                background: "var(--surface-card)",
                borderRadius: "12px",
                padding: "1.25rem",
                border: "1px solid var(--border-subtle)",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-secondary)" }}>
                  สถานีออนไลน์ปกติ
                </span>
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 32,
                    height: 32,
                    borderRadius: "8px",
                    background: "#dcfce7",
                    color: "#166534",
                  }}
                >
                  <Wifi style={{ width: 18, height: 18 }} />
                </span>
              </div>
              <div style={{ fontSize: "2rem", fontWeight: 800, color: "#16a34a" }}>
                {summary ? summary.online_stations : "-"}
                <span style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text-muted)", marginLeft: "0.5rem" }}>
                  / {summary ? summary.total_stations : "-"} สถานี
                </span>
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                ส่งข้อมูลสม่ำเสมอภายใน 15 นาที
              </div>
            </div>

            {/* Degraded Stations */}
            <div
              style={{
                background: "var(--surface-card)",
                borderRadius: "12px",
                padding: "1.25rem",
                border: "1px solid var(--border-subtle)",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-secondary)" }}>
                  เฝ้าระวัง (เสื่อมถอย)
                </span>
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 32,
                    height: 32,
                    borderRadius: "8px",
                    background: "#fef3c7",
                    color: "#92400e",
                  }}
                >
                  <AlertTriangle style={{ width: 18, height: 18 }} />
                </span>
              </div>
              <div style={{ fontSize: "2rem", fontWeight: 800, color: "#d97706" }}>
                {summary ? summary.degraded_stations : "-"}
                <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-muted)", marginLeft: "0.5rem" }}>
                  สถานี
                </span>
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                แบตเตอรี่ต่ำกว่า 20% หรือ RSSI &lt; -85dBm
              </div>
            </div>

            {/* Offline Stations */}
            <div
              style={{
                background: "var(--surface-card)",
                borderRadius: "12px",
                padding: "1.25rem",
                border: "1px solid var(--border-subtle)",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-secondary)" }}>
                  สถานีออฟไลน์ (หลุดติดต่อ)
                </span>
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 32,
                    height: 32,
                    borderRadius: "8px",
                    background: "#fee2e2",
                    color: "#991b1b",
                  }}
                >
                  <WifiOff style={{ width: 18, height: 18 }} />
                </span>
              </div>
              <div style={{ fontSize: "2rem", fontWeight: 800, color: "#dc2626" }}>
                {summary ? summary.offline_stations : "-"}
                <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-muted)", marginLeft: "0.5rem" }}>
                  สถานี
                </span>
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                ไม่ส่งข้อมูลเกิน 60 นาที
              </div>
            </div>

            {/* Total Sensors Monitoring */}
            <div
              style={{
                background: "var(--surface-card)",
                borderRadius: "12px",
                padding: "1.25rem",
                border: "1px solid var(--border-subtle)",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-secondary)" }}>
                  เซนเซอร์วัดดินในสวน
                </span>
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 32,
                    height: 32,
                    borderRadius: "8px",
                    background: "var(--brand-100)",
                    color: "var(--brand-800)",
                  }}
                >
                  <Layers style={{ width: 18, height: 18 }} />
                </span>
              </div>
              <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--brand-700)" }}>
                {summary ? summary.total_sensors : "-"}
                <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-muted)", marginLeft: "0.5rem" }}>
                  ตัว
                </span>
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                โพรบวัดดิน NPK / ความชื้นที่ติดตั้ง
              </div>
            </div>
          </div>

          {/* Weather Stations Section */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                สถานีตรวจวัดอากาศและแปลง ({summary?.stations.length || 0})
              </h2>
            </div>

            {loading ? (
              <div
                style={{
                  padding: "3rem",
                  textAlign: "center",
                  background: "var(--surface-card)",
                  borderRadius: "12px",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <LoaderCircle
                  style={{ width: 28, height: 28, color: "var(--brand-600)", animation: "spin 1s linear infinite" }}
                />
                <p style={{ marginTop: "0.5rem", color: "var(--text-secondary)" }}>กำลังโหลดสถานะสุขภาพอุปกรณ์...</p>
              </div>
            ) : !summary || summary.stations.length === 0 ? (
              <div
                style={{
                  padding: "3rem",
                  textAlign: "center",
                  background: "var(--surface-card)",
                  borderRadius: "12px",
                  border: "1px dashed var(--border-subtle)",
                }}
              >
                <Cpu style={{ width: 36, height: 36, color: "var(--text-muted)", margin: "0 auto 0.5rem" }} />
                <p style={{ fontWeight: 600, color: "var(--text-primary)" }}>ยังไม่พบสถานีตรวจวัดในสวนนี้</p>
                <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                  ลงทะเบียนสถานีสภาพอากาศใหม่ได้ที่หน้าจัดการทะเบียนอุปกรณ์
                </p>
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                  gap: "1.25rem",
                }}
              >
                {summary.stations.map((st) => {
                  const isOnline = st.status === "ONLINE";
                  const isDegraded = st.status === "DEGRADED";

                  const battPct = st.battery_pct ?? null;
                  const battColor =
                    battPct == null ? "#9ca3af" : battPct >= 50 ? "#16a34a" : battPct >= 20 ? "#d97706" : "#dc2626";

                  const rssi = st.rssi_dbm ?? null;
                  const rssiLabel =
                    st.signal_quality === "EXCELLENT"
                      ? "ดีเยี่ยม"
                      : st.signal_quality === "GOOD"
                      ? "ดี"
                      : st.signal_quality === "FAIR"
                      ? "พอใช้"
                      : st.signal_quality === "POOR"
                      ? "อ่อนวิกฤต"
                      : "ไม่ทราบ";

                  return (
                    <div
                      key={st.station_id}
                      style={{
                        background: "var(--surface-card)",
                        borderRadius: "12px",
                        border: "1px solid var(--border-subtle)",
                        padding: "1.25rem",
                        boxShadow: "0 2px 4px rgba(0,0,0,0.03)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "1rem",
                        position: "relative",
                      }}
                    >
                      {/* Top Bar: Code, Name, Plot & Status Badge */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <span
                              style={{
                                fontSize: "0.75rem",
                                fontWeight: 800,
                                color: "var(--brand-700)",
                                background: "var(--brand-100)",
                                padding: "2px 6px",
                                borderRadius: "4px",
                              }}
                            >
                              {st.station_code}
                            </span>
                            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                              {st.plot_name || "ไม่ได้ระบุแปลง"}
                            </span>
                          </div>
                          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0.25rem 0 0", color: "var(--text-primary)" }}>
                            {st.display_name}
                          </h3>
                        </div>

                        {/* Status Badge */}
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.35rem",
                            fontSize: "0.8rem",
                            fontWeight: 700,
                            padding: "4px 10px",
                            borderRadius: "999px",
                            background: isOnline ? "#dcfce7" : isDegraded ? "#fef3c7" : "#fee2e2",
                            color: isOnline ? "#166534" : isDegraded ? "#92400e" : "#991b1b",
                            border: `1px solid ${isOnline ? "#86efac" : isDegraded ? "#fde68a" : "#fca5a5"}`,
                          }}
                        >
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              background: isOnline ? "#16a34a" : isDegraded ? "#d97706" : "#dc2626",
                            }}
                          />
                          {isOnline ? "ออนไลน์" : isDegraded ? "เสื่อมถอย" : "ออฟไลน์"}
                        </span>
                      </div>

                      {/* Gauges: Battery & RSSI */}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: "0.75rem",
                          background: "var(--surface-sunken)",
                          padding: "0.85rem",
                          borderRadius: "8px",
                        }}
                      >
                        {/* Battery Level */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                            <Battery style={{ width: 14, height: 14, color: battColor }} />
                            <span>ระดับแบตเตอรี่</span>
                          </div>
                          <div style={{ fontSize: "1.1rem", fontWeight: 800, color: battColor }}>
                            {battPct != null ? `${battPct.toFixed(1)}%` : "N/A"}
                          </div>
                          {/* Battery Bar */}
                          <div
                            style={{
                              height: 5,
                              width: "100%",
                              background: "rgba(0,0,0,0.06)",
                              borderRadius: 3,
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                height: "100%",
                                width: `${Math.min(Math.max(battPct || 0, 0), 100)}%`,
                                background: battColor,
                              }}
                            />
                          </div>
                        </div>

                        {/* Signal Quality */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                            <Radio style={{ width: 14, height: 14, color: "var(--text-secondary)" }} />
                            <span>สัญญาณ (RSSI)</span>
                          </div>
                          <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--text-primary)" }}>
                            {rssi != null ? `${rssi} dBm` : "N/A"}
                          </div>
                          <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)" }}>
                            {rssiLabel}
                          </span>
                        </div>
                      </div>

                      {/* Footer Info & Modal Button */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          fontSize: "0.8rem",
                          color: "var(--text-secondary)",
                          borderTop: "1px solid var(--border-subtle)",
                          paddingTop: "0.75rem",
                        }}
                      >
                        <div>
                          <span>พบข้อมูลล่าสุด: </span>
                          <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                            {st.last_seen
                              ? new Date(st.last_seen).toLocaleTimeString("th-TH", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  second: "2-digit",
                                })
                              : "ไม่เคยพบ"}
                          </span>
                        </div>

                        <button
                          onClick={() => openHealthDetail(st.station_id)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.35rem",
                            background: "transparent",
                            border: "none",
                            color: "var(--brand-700)",
                            fontWeight: 700,
                            cursor: "pointer",
                            padding: "4px 8px",
                            borderRadius: "4px",
                          }}
                        >
                          <Eye style={{ width: 14, height: 14 }} />
                          ดูประวัติสุขภาพ
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Soil Sensors Health Section */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
              สถานะเซนเซอร์วัดดินในสวน ({summary?.sensors.length || 0})
            </h2>

            {!summary || summary.sensors.length === 0 ? (
              <div
                style={{
                  padding: "2rem",
                  textAlign: "center",
                  background: "var(--surface-card)",
                  borderRadius: "12px",
                  border: "1px dashed var(--border-subtle)",
                  color: "var(--text-secondary)",
                }}
              >
                ยังไม่มีการบันทึกเซนเซอร์วัดดินในระบบ
              </div>
            ) : (
              <div
                style={{
                  background: "var(--surface-card)",
                  borderRadius: "12px",
                  border: "1px solid var(--border-subtle)",
                  overflowX: "auto",
                }}
              >
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.9rem" }}>
                  <thead>
                    <tr style={{ background: "var(--surface-sunken)", borderBottom: "1px solid var(--border-subtle)" }}>
                      <th style={{ padding: "0.75rem 1rem", fontWeight: 700, color: "var(--text-secondary)" }}>รหัสอุปกรณ์</th>
                      <th style={{ padding: "0.75rem 1rem", fontWeight: 700, color: "var(--text-secondary)" }}>ชื่อเรียก</th>
                      <th style={{ padding: "0.75rem 1rem", fontWeight: 700, color: "var(--text-secondary)" }}>ประเภทโพรบ</th>
                      <th style={{ padding: "0.75rem 1rem", fontWeight: 700, color: "var(--text-secondary)" }}>แปลงที่ติดตั้ง</th>
                      <th style={{ padding: "0.75rem 1rem", fontWeight: 700, color: "var(--text-secondary)" }}>สถานะสัญญาณ</th>
                      <th style={{ padding: "0.75rem 1rem", fontWeight: 700, color: "var(--text-secondary)" }}>เวลาที่รับข้อมูลล่าสุด</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.sensors.map((s) => {
                      const isOnline = s.status === "ONLINE";
                      return (
                        <tr key={s.sensor_id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                          <td style={{ padding: "0.75rem 1rem", fontWeight: 700, color: "var(--brand-700)" }}>
                            {s.sensor_code}
                          </td>
                          <td style={{ padding: "0.75rem 1rem", fontWeight: 600, color: "var(--text-primary)" }}>
                            {s.display_name}
                          </td>
                          <td style={{ padding: "0.75rem 1rem", color: "var(--text-secondary)" }}>
                            <span
                              style={{
                                fontSize: "0.75rem",
                                fontWeight: 700,
                                background: "var(--surface-sunken)",
                                padding: "2px 6px",
                                borderRadius: "4px",
                              }}
                            >
                              {s.sensor_type}
                            </span>
                          </td>
                          <td style={{ padding: "0.75rem 1rem", color: "var(--text-secondary)" }}>
                            {s.plot_name || "-"}
                          </td>
                          <td style={{ padding: "0.75rem 1rem" }}>
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.3rem",
                                fontSize: "0.8rem",
                                fontWeight: 700,
                                padding: "2px 8px",
                                borderRadius: "999px",
                                background: isOnline ? "#dcfce7" : "#fee2e2",
                                color: isOnline ? "#166534" : "#991b1b",
                              }}
                            >
                              <span
                                style={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: "50%",
                                  background: isOnline ? "#16a34a" : "#dc2626",
                                }}
                              />
                              {isOnline ? "ปกติ" : "ขาดการส่งข้อมูล"}
                            </span>
                          </td>
                          <td style={{ padding: "0.75rem 1rem", color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                            {s.last_seen
                              ? new Date(s.last_seen).toLocaleString("th-TH", {
                                  dateStyle: "short",
                                  timeStyle: "short",
                                })
                              : "ยังไม่มีข้อมูล"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Data Gap Report */}
      {activeTab === "gaps" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Controls: Range, Threshold, Station Filter, Export */}
          <div
            style={{
              background: "var(--surface-card)",
              borderRadius: "12px",
              padding: "1.25rem",
              border: "1px solid var(--border-subtle)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "1rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
              {/* Time Range */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-secondary)" }}>ช่วงเวลา:</span>
                <div style={{ display: "flex", background: "var(--surface-sunken)", padding: "2px", borderRadius: "8px" }}>
                  {[
                    { label: "24 ชม.", val: 24 },
                    { label: "7 วัน", val: 168 },
                    { label: "30 วัน", val: 720 },
                  ].map((t) => (
                    <button
                      key={t.val}
                      onClick={() => setTimeRangeHours(t.val)}
                      style={{
                        padding: "4px 10px",
                        borderRadius: "6px",
                        border: "none",
                        fontSize: "0.8rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        background: timeRangeHours === t.val ? "var(--brand-600)" : "transparent",
                        color: timeRangeHours === t.val ? "#ffffff" : "var(--text-secondary)",
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Threshold */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-secondary)" }}>เกณฑ์ตัดสิน Gap:</span>
                <select
                  value={thresholdMinutes}
                  onChange={(e) => setThresholdMinutes(Number(e.target.value))}
                  style={{
                    padding: "4px 8px",
                    borderRadius: "6px",
                    border: "1px solid var(--border-subtle)",
                    background: "var(--surface-card)",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                  }}
                >
                  <option value={15}>15 นาที</option>
                  <option value={30}>30 นาที (มาตรฐาน)</option>
                  <option value={60}>60 นาที (1 ชม.)</option>
                  <option value={120}>2 ชั่วโมง</option>
                </select>
              </div>

              {/* Station Filter */}
              {summary && summary.stations.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-secondary)" }}>สถานี:</span>
                  <select
                    value={filterStationId}
                    onChange={(e) => setFilterStationId(e.target.value)}
                    style={{
                      padding: "4px 8px",
                      borderRadius: "6px",
                      border: "1px solid var(--border-subtle)",
                      background: "var(--surface-card)",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                    }}
                  >
                    <option value="ALL">ทุกสถานีในสวน</option>
                    {summary.stations.map((st) => (
                      <option key={st.station_id} value={st.station_id}>
                        {st.station_code} - {st.display_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Export button */}
            <button
              onClick={exportGapsCsv}
              disabled={!gapReport || gapReport.gaps.length === 0}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                padding: "0.5rem 1rem",
                borderRadius: "8px",
                border: "1px solid var(--border-subtle)",
                background: gapReport && gapReport.gaps.length > 0 ? "var(--brand-600)" : "var(--surface-sunken)",
                color: gapReport && gapReport.gaps.length > 0 ? "#ffffff" : "var(--text-muted)",
                fontWeight: 700,
                fontSize: "0.85rem",
                cursor: gapReport && gapReport.gaps.length > 0 ? "pointer" : "not-allowed",
              }}
            >
              <Download style={{ width: 15, height: 15 }} />
              ส่งออก CSV
            </button>
          </div>

          {/* KPI Gap Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "1rem",
            }}
          >
            {/* Overall Completeness */}
            <div
              style={{
                background: "var(--surface-card)",
                borderRadius: "12px",
                padding: "1.25rem",
                border: "1px solid var(--border-subtle)",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-secondary)" }}>
                ความสมบูรณ์ของข้อมูลรวม (Data Completeness)
              </span>
              <div
                style={{
                  fontSize: "2rem",
                  fontWeight: 800,
                  color:
                    (gapReport?.overall_completeness_pct ?? 100) >= 95
                      ? "#16a34a"
                      : (gapReport?.overall_completeness_pct ?? 100) >= 80
                      ? "#d97706"
                      : "#dc2626",
                }}
              >
                {gapReport ? `${gapReport.overall_completeness_pct}%` : "-"}
              </div>
              <div style={{ height: 6, background: "rgba(0,0,0,0.06)", borderRadius: 3, overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${gapReport?.overall_completeness_pct ?? 100}%`,
                    background:
                      (gapReport?.overall_completeness_pct ?? 100) >= 95
                        ? "#16a34a"
                        : (gapReport?.overall_completeness_pct ?? 100) >= 80
                        ? "#d97706"
                        : "#dc2626",
                  }}
                />
              </div>
            </div>

            {/* Total Gap Duration */}
            <div
              style={{
                background: "var(--surface-card)",
                borderRadius: "12px",
                padding: "1.25rem",
                border: "1px solid var(--border-subtle)",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-secondary)" }}>
                เวลารวมที่สัญญาณขาดหาย
              </span>
              <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--text-primary)" }}>
                {gapReport
                  ? `${(gapReport.total_gap_duration_seconds / 3600).toFixed(1)} ชม.`
                  : "-"}
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                สะสมตลอดช่วง {timeRangeHours < 24 ? `${timeRangeHours} ชั่วโมง` : `${timeRangeHours / 24} วัน`}
              </div>
            </div>

            {/* Total Gaps Count */}
            <div
              style={{
                background: "var(--surface-card)",
                borderRadius: "12px",
                padding: "1.25rem",
                border: "1px solid var(--border-subtle)",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-secondary)" }}>
                จำนวนรอบที่ข้อมูลขาดช่วง
              </span>
              <div style={{ fontSize: "2rem", fontWeight: 800, color: (gapReport?.total_gaps_count ?? 0) > 0 ? "#d97706" : "#16a34a" }}>
                {gapReport ? gapReport.total_gaps_count : "-"}
                <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-muted)", marginLeft: "0.5rem" }}>
                  ครั้ง
                </span>
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                ช่วงที่หยุดส่งสัญญาณเกิน {thresholdMinutes} นาที
              </div>
            </div>
          </div>

          {/* Station Completeness Breakdown */}
          {gapReport && gapReport.stations_summary.length > 0 && (
            <div
              style={{
                background: "var(--surface-card)",
                borderRadius: "12px",
                padding: "1.25rem",
                border: "1px solid var(--border-subtle)",
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
              }}
            >
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
                อัตราความสมบูรณ์ของสัญญาณแยกตามสถานี
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
                {gapReport.stations_summary.map((st) => (
                  <div
                    key={st.station_id}
                    style={{
                      background: "var(--surface-sunken)",
                      padding: "0.85rem 1rem",
                      borderRadius: "8px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.5rem",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text-primary)" }}>
                        {st.station_code} ({st.station_name})
                      </span>
                      <span
                        style={{
                          fontWeight: 800,
                          fontSize: "0.95rem",
                          color: st.completeness_pct >= 95 ? "#16a34a" : st.completeness_pct >= 80 ? "#d97706" : "#dc2626",
                        }}
                      >
                        {st.completeness_pct}%
                      </span>
                    </div>
                    <div style={{ height: 6, background: "rgba(0,0,0,0.06)", borderRadius: 3, overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${st.completeness_pct}%`,
                          background: st.completeness_pct >= 95 ? "#16a34a" : st.completeness_pct >= 80 ? "#d97706" : "#dc2626",
                        }}
                      />
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "flex", justifyContent: "space-between" }}>
                      <span>พบ Gap {st.total_gaps} ครั้ง</span>
                      <span>รวม {(st.total_gap_seconds / 3600).toFixed(1)} ชม.</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Data Gaps Detail Table */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
              รายการบันทึกสัญญาณขาดหาย (Data Gaps Breakdown)
            </h3>

            {gapsLoading ? (
              <div
                style={{
                  padding: "3rem",
                  textAlign: "center",
                  background: "var(--surface-card)",
                  borderRadius: "12px",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <LoaderCircle
                  style={{ width: 28, height: 28, color: "var(--brand-600)", animation: "spin 1s linear infinite" }}
                />
                <p style={{ marginTop: "0.5rem", color: "var(--text-secondary)" }}>กำลังวิเคราะห์ช่วงเวลาที่ข้อมูลขาดหาย...</p>
              </div>
            ) : !gapReport || gapReport.gaps.length === 0 ? (
              <div
                style={{
                  padding: "3rem",
                  textAlign: "center",
                  background: "var(--surface-card)",
                  borderRadius: "12px",
                  border: "1px dashed var(--border-subtle)",
                }}
              >
                <CheckCircle2 style={{ width: 36, height: 36, color: "#16a34a", margin: "0 auto 0.5rem" }} />
                <p style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: "1.1rem" }}>
                  สัญญาณสมบูรณ์ 100% ไม่พบ Data Gap ในช่วงเวลานี้
                </p>
                <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                  ทุกสถานีส่งข้อมูลสภาพอากาศและเซนเซอร์ดินเข้ามาตามรอบเวลาปกติ
                </p>
              </div>
            ) : (
              <div
                style={{
                  background: "var(--surface-card)",
                  borderRadius: "12px",
                  border: "1px solid var(--border-subtle)",
                  overflowX: "auto",
                }}
              >
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.9rem" }}>
                  <thead>
                    <tr style={{ background: "var(--surface-sunken)", borderBottom: "1px solid var(--border-subtle)" }}>
                      <th style={{ padding: "0.75rem 1rem", fontWeight: 700, color: "var(--text-secondary)" }}>สถานี / แปลง</th>
                      <th style={{ padding: "0.75rem 1rem", fontWeight: 700, color: "var(--text-secondary)" }}>ช่วงเวลาที่ขาดหาย</th>
                      <th style={{ padding: "0.75rem 1rem", fontWeight: 700, color: "var(--text-secondary)" }}>ระยะเวลา</th>
                      <th style={{ padding: "0.75rem 1rem", fontWeight: 700, color: "var(--text-secondary)" }}>ระดับความรุนแรง</th>
                      <th style={{ padding: "0.75rem 1rem", fontWeight: 700, color: "var(--text-secondary)" }}>สาเหตุที่คาดการณ์</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gapReport.gaps.map((gap) => {
                      const isCrit = gap.severity === "CRITICAL";
                      const isMod = gap.severity === "MODERATE";
                      return (
                        <tr key={gap.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                          <td style={{ padding: "0.75rem 1rem" }}>
                            <div style={{ fontWeight: 700, color: "var(--brand-700)" }}>{gap.station_code}</div>
                            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                              {gap.station_name} • {gap.plot_name || "ไม่ระบุแปลง"}
                            </div>
                          </td>
                          <td style={{ padding: "0.75rem 1rem", color: "var(--text-primary)" }}>
                            <div>{new Date(gap.gap_start).toLocaleString("th-TH")}</div>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                              ถึง {new Date(gap.gap_end).toLocaleString("th-TH")}
                            </div>
                          </td>
                          <td style={{ padding: "0.75rem 1rem", fontWeight: 700, color: "var(--text-primary)" }}>
                            {gap.duration_formatted}
                          </td>
                          <td style={{ padding: "0.75rem 1rem" }}>
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.3rem",
                                fontSize: "0.75rem",
                                fontWeight: 800,
                                padding: "3px 8px",
                                borderRadius: "999px",
                                background: isCrit ? "#fee2e2" : isMod ? "#ffedd5" : "#fef3c7",
                                color: isCrit ? "#991b1b" : isMod ? "#9a3412" : "#92400e",
                              }}
                            >
                              {gap.severity}
                            </span>
                          </td>
                          <td style={{ padding: "0.75rem 1rem", color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                            {gap.probable_cause}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Deep-Dive Device Health Modal */}
      {selectedStationId && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1rem",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedStationId(null);
          }}
        >
          <div
            style={{
              background: "var(--surface-card)",
              borderRadius: "16px",
              border: "1px solid var(--border-subtle)",
              width: "100%",
              maxWidth: "680px",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "1.25rem 1.5rem",
                borderBottom: "1px solid var(--border-subtle)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 800, margin: 0, color: "var(--text-primary)" }}>
                  ประวัติสุขภาพและสัญญาณอุปกรณ์เชิงลึก
                </h3>
                <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                  รหัสอุปกรณ์: {healthDetail?.device_code || selectedStationId}
                </span>
              </div>
              <button
                onClick={() => setSelectedStationId(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-secondary)",
                }}
              >
                <X style={{ width: 20, height: 20 }} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              {detailLoading ? (
                <div style={{ padding: "3rem", textAlign: "center" }}>
                  <LoaderCircle
                    style={{ width: 28, height: 28, color: "var(--brand-600)", animation: "spin 1s linear infinite" }}
                  />
                  <p style={{ marginTop: "0.5rem", color: "var(--text-secondary)" }}>กำลังโหลดประวัติสุขภาพ...</p>
                </div>
              ) : healthDetail ? (
                <>
                  {/* Status Banner */}
                  <div
                    style={{
                      padding: "1rem",
                      borderRadius: "10px",
                      background:
                        healthDetail.status === "ONLINE"
                          ? "#dcfce7"
                          : healthDetail.status === "DEGRADED"
                          ? "#fef3c7"
                          : "#fee2e2",
                      border: `1px solid ${
                        healthDetail.status === "ONLINE"
                          ? "#86efac"
                          : healthDetail.status === "DEGRADED"
                          ? "#fde68a"
                          : "#fca5a5"
                      }`,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "var(--text-primary)" }}>
                        {healthDetail.display_name}
                      </div>
                      <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                        แปลง: {healthDetail.plot_name || "ไม่ได้ระบุ"} • เฟิร์มแวร์: {healthDetail.firmware_version || "2.1.0"}
                      </div>
                    </div>

                    <span
                      style={{
                        fontWeight: 800,
                        fontSize: "0.85rem",
                        padding: "4px 10px",
                        borderRadius: "999px",
                        background: "#ffffff",
                        color:
                          healthDetail.status === "ONLINE"
                            ? "#166534"
                            : healthDetail.status === "DEGRADED"
                            ? "#92400e"
                            : "#991b1b",
                      }}
                    >
                      {healthDetail.status === "ONLINE"
                        ? "🟢 ออนไลน์ปกติ"
                        : healthDetail.status === "DEGRADED"
                        ? "🟡 เฝ้าระวัง"
                        : "🔴 ขาดการติดต่อ"}
                    </span>
                  </div>

                  {/* Diagnostic Metrics Grid */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                      gap: "1rem",
                    }}
                  >
                    {/* Battery */}
                    <div style={{ background: "var(--surface-sunken)", padding: "1rem", borderRadius: "8px" }}>
                      <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>แบตเตอรี่ & แรงดัน</span>
                      <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--text-primary)", margin: "0.25rem 0" }}>
                        {healthDetail.battery_pct != null ? `${healthDetail.battery_pct}%` : "N/A"}
                      </div>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        แรงดัน: {healthDetail.battery_voltage ? `${healthDetail.battery_voltage}V` : "4.15V"} ({healthDetail.battery_status})
                      </span>
                    </div>

                    {/* Signal */}
                    <div style={{ background: "var(--surface-sunken)", padding: "1rem", borderRadius: "8px" }}>
                      <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>ระดับสัญญาณ RSSI</span>
                      <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--text-primary)", margin: "0.25rem 0" }}>
                        {healthDetail.rssi_dbm != null ? `${healthDetail.rssi_dbm} dBm` : "N/A"}
                      </div>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        คุณภาพสัญญาณ: {healthDetail.signal_quality}
                      </span>
                    </div>

                    {/* Uptime */}
                    <div style={{ background: "var(--surface-sunken)", padding: "1rem", borderRadius: "8px" }}>
                      <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>ระยะเวลาเปิดใช้งาน (Uptime)</span>
                      <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--text-primary)", margin: "0.25rem 0" }}>
                        {healthDetail.uptime_formatted || "-"}
                      </div>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        {healthDetail.uptime_seconds ? `${healthDetail.uptime_seconds} วินาที` : "ทำงานต่อเนื่อง"}
                      </span>
                    </div>
                  </div>

                  {/* Health Telemetry History Table */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <h4 style={{ fontSize: "1rem", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
                      บันทึกประวัติการส่งสัญญาณ 10 ครั้งล่าสุด
                    </h4>

                    {healthDetail.recent_history.length === 0 ? (
                      <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>ยังไม่มีบันทึกประวัติสถานะ</p>
                    ) : (
                      <div style={{ maxHeight: "240px", overflowY: "auto", border: "1px solid var(--border-subtle)", borderRadius: "8px" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", textAlign: "left" }}>
                          <thead>
                            <tr style={{ background: "var(--surface-sunken)", borderBottom: "1px solid var(--border-subtle)" }}>
                              <th style={{ padding: "6px 12px" }}>วัน-เวลา</th>
                              <th style={{ padding: "6px 12px" }}>แบตเตอรี่</th>
                              <th style={{ padding: "6px 12px" }}>RSSI</th>
                              <th style={{ padding: "6px 12px" }}>สถานะ</th>
                            </tr>
                          </thead>
                          <tbody>
                            {healthDetail.recent_history.slice(0, 10).map((h, idx) => (
                              <tr key={idx} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                                <td style={{ padding: "6px 12px", color: "var(--text-secondary)" }}>
                                  {new Date(h.recorded_at).toLocaleTimeString("th-TH")}
                                </td>
                                <td style={{ padding: "6px 12px", fontWeight: 600 }}>
                                  {h.battery_pct != null ? `${h.battery_pct}%` : "-"}
                                </td>
                                <td style={{ padding: "6px 12px" }}>
                                  {h.rssi_dbm != null ? `${h.rssi_dbm} dBm` : "-"}
                                </td>
                                <td style={{ padding: "6px 12px" }}>
                                  <span
                                    style={{
                                      fontSize: "0.75rem",
                                      fontWeight: 700,
                                      color: h.status === "ONLINE" ? "#16a34a" : "#dc2626",
                                    }}
                                  >
                                    {h.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
