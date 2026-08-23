"use client";

import {
  Battery,
  CloudSun,
  Cpu,
  Droplets,
  Leaf,
  LineChart,
  LoaderCircle,
  Radio,
  RefreshCw,
  Sliders,
  Sun,
  Thermometer,
  Wind,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";

type Farm = { id: string; name: string; timezone: string };
type Plot = { id: string; name: string };

type MetricValue = {
  metric_key: string;
  value: number | null;
  raw_value: number | null;
  unit: string;
  quality: string;
  observed_at: string;
};

type StationSummary = {
  station_id: string;
  station_code: string;
  display_name: string;
  plot_id: string | null;
  plot_name: string | null;
  status: string;
  battery_pct: number | null;
  rssi_dbm: number | null;
  last_seen: string | null;
  metrics: Record<string, MetricValue>;
};

type SensorSummary = {
  sensor_id: string;
  sensor_code: string;
  display_name: string;
  sensor_type: string;
  plot_id: string | null;
  plot_name: string | null;
  last_seen: string | null;
  metrics: Record<string, MetricValue>;
};

type LatestTelemetry = {
  farm_id: string;
  retrieved_at: string;
  stations: StationSummary[];
  sensors: SensorSummary[];
};

type TimeSeriesPoint = {
  timestamp: string;
  value: number | null;
  min_value?: number | null;
  max_value?: number | null;
  count?: number;
  quality?: string;
};

type TimeSeriesData = {
  farm_id: string;
  metric_key: string;
  unit: string;
  interval: string;
  points: TimeSeriesPoint[];
};

const METRIC_LABELS: Record<string, { label: string; unit: string; icon: typeof Thermometer; color: string; desc: string }> = {
  air_temperature: { label: "อุณหภูมิอากาศ", unit: "°C", icon: Thermometer, color: "#e0633b", desc: "ช่วงเหมาะสม 24-34°C" },
  air_relative_humidity: { label: "ความชื้นสัมพัทธ์ในอากาศ", unit: "%RH", icon: Droplets, color: "#1982c4", desc: "ช่วงเหมาะสม 60-85%RH" },
  illuminance: { label: "ความเข้มแสงแดด", unit: "lux", icon: Sun, color: "#e89923", desc: "แสงแดดเพื่อการสังเคราะห์แสง" },
  wind_speed_avg_5m: { label: "ความเร็วลมเฉลี่ย", unit: "m/s", icon: Wind, color: "#6a7b82", desc: "การถ่ายเทอากาศในทรงพุ่ม" },
  soil_temperature: { label: "อุณหภูมิดิน", unit: "°C", icon: Thermometer, color: "#b36200", desc: "ช่วงเหมาะสม 25-30°C" },
  soil_moisture: { label: "ความชื้นในดิน", unit: "%", icon: Droplets, color: "#2563eb", desc: "ทุเรียนต้องการความชื้น 45-60%" },
  soil_ec: { label: "การนำไฟฟ้าในดิน (EC)", unit: "µS/cm", icon: Zap, color: "#8b5cf6", desc: "ความเค็ม/แร่ธาตุปุ๋ย 800-1500" },
  soil_ph: { label: "ความเป็นกรด-ด่างดิน (pH)", unit: "pH", icon: Sliders, color: "#10b981", desc: "ค่า pH เหมาะสม 5.5 - 6.5" },
  soil_n: { label: "ไนโตรเจน (N)", unit: "mg/kg", icon: Leaf, color: "#059669", desc: "ธาตุอาหารบำรุงใบและยอด" },
  soil_p: { label: "ฟอสฟอรัส (P)", unit: "mg/kg", icon: Leaf, color: "#d97706", desc: "ธาตุอาหารสะสมตาดอกและราก" },
  soil_k: { label: "โพแทสเซียม (K)", unit: "mg/kg", icon: Leaf, color: "#7c3aed", desc: "ธาตุอาหารขยายผลและรสหวาน" },
};

export function TelemetryDashboard() {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [farmId, setFarmId] = useState("");
  const [plots, setPlots] = useState<Plot[]>([]);
  const [selectedPlotId, setSelectedPlotId] = useState<string>("all");

  const [telemetry, setTelemetry] = useState<LatestTelemetry | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);

  // Time Series States
  const [selectedMetric, setSelectedMetric] = useState<string>("soil_moisture");
  const [timeRange, setTimeRange] = useState<"24h" | "7d" | "30d">("24h");
  const [seriesInterval, setSeriesInterval] = useState<"auto" | "raw" | "5m" | "15m" | "1h" | "1d">("auto");
  const [seriesData, setSeriesData] = useState<TimeSeriesData | null>(null);
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [error, setError] = useState("");

  // Determine effective downsample interval
  const effectiveInterval = useMemo(() => {
    if (seriesInterval !== "auto") return seriesInterval;
    if (timeRange === "24h") return "15m";
    if (timeRange === "7d") return "1h";
    return "1d";
  }, [seriesInterval, timeRange]);

  // Load farms
  useEffect(() => {
    let cancelled = false;
    apiFetch<Farm[]>("/farms")
      .then((items) => {
        if (cancelled) return;
        setFarms(items);
        setFarmId(items[0]?.id || "");
      })
      .catch(() => {
        if (!cancelled) setError("โหลดข้อมูลสวนไม่สำเร็จ");
      });
    return () => { cancelled = true; };
  }, []);

  // Load plots when farmId changes
  useEffect(() => {
    if (!farmId) return;
    apiFetch<Plot[]>(`/farms/${farmId}/plots`)
      .then(setPlots)
      .catch(() => setPlots([]));
  }, [farmId]);

  // Load latest telemetry
  const loadLatestTelemetry = useCallback(async () => {
    if (!farmId) return;
    try {
      const data = await apiFetch<LatestTelemetry>(`/farms/${farmId}/telemetry/latest`);
      setTelemetry(data);
    } catch {
      // keep previous telemetry if temporary network hitch
    } finally {
      setLoading(false);
    }
  }, [farmId]);

  useEffect(() => {
    let active = true;
    if (!farmId) return;
    apiFetch<LatestTelemetry>(`/farms/${farmId}/telemetry/latest`)
      .then((data) => {
        if (active) {
          setTelemetry(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [farmId]);

  // Auto-refresh timer
  useEffect(() => {
    if (!autoRefresh || !farmId) return;
    const interval = setInterval(() => {
      loadLatestTelemetry();
      setRefreshTick((t) => t + 1);
    }, 10000); // 10s auto-refresh
    return () => clearInterval(interval);
  }, [autoRefresh, farmId, loadLatestTelemetry]);

  // Load time series
  const loadTimeSeries = useCallback(async () => {
    if (!farmId || !selectedMetric) return;
    setSeriesLoading(true);
    try {
      const now = new Date();
      let fromTime: Date;
      if (timeRange === "24h") fromTime = new Date(now.getTime() - 24 * 3600 * 1000);
      else if (timeRange === "7d") fromTime = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
      else fromTime = new Date(now.getTime() - 30 * 24 * 3600 * 1000);

      const qs = new URLSearchParams({
        metric_key: selectedMetric,
        from_time: fromTime.toISOString(),
        to_time: now.toISOString(),
        interval: effectiveInterval,
      });

      const res = await apiFetch<TimeSeriesData>(`/farms/${farmId}/telemetry/series?${qs.toString()}`);
      setSeriesData(res);
    } catch {
      setSeriesData(null);
    } finally {
      setSeriesLoading(false);
    }
  }, [farmId, selectedMetric, timeRange, effectiveInterval]);

  useEffect(() => {
    let active = true;
    if (!farmId || !selectedMetric) return;
    const now = new Date();
    let fromTime: Date;
    if (timeRange === "24h") fromTime = new Date(now.getTime() - 24 * 3600 * 1000);
    else if (timeRange === "7d") fromTime = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
    else fromTime = new Date(now.getTime() - 30 * 24 * 3600 * 1000);

    const qs = new URLSearchParams({
      metric_key: selectedMetric,
      from_time: fromTime.toISOString(),
      to_time: now.toISOString(),
      interval: effectiveInterval,
    });

    apiFetch<TimeSeriesData>(`/farms/${farmId}/telemetry/series?${qs.toString()}`)
      .then((res) => {
        if (active) setSeriesData(res);
      })
      .catch(() => {
        if (active) setSeriesData(null);
      });

    return () => { active = false; };
  }, [farmId, selectedMetric, timeRange, effectiveInterval, refreshTick]);

  // Filtered stations and sensors by plot
  const filteredStations = useMemo(() => {
    if (!telemetry) return [];
    if (selectedPlotId === "all") return telemetry.stations;
    return telemetry.stations.filter((st) => st.plot_id === selectedPlotId);
  }, [telemetry, selectedPlotId]);

  const filteredSensors = useMemo(() => {
    if (!telemetry) return [];
    if (selectedPlotId === "all") return telemetry.sensors;
    return telemetry.sensors.filter((s) => s.plot_id === selectedPlotId);
  }, [telemetry, selectedPlotId]);



  return (
    <>
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">Real-Time Farm Telemetry</p>
          <h1>ข้อมูลตรวจวัดและสถิติสวน</h1>
          <p>ติดตามสภาพอากาศ คุณภาพดิน ความชื้น และระดับแร่ธาตุ NPK จากเซนเซอร์ภาคสนามตามเวลาจริง</p>
        </div>
        <div className="workspace-heading__actions" style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
          <button
            className={`button ${autoRefresh ? "button--secondary" : "button--ghost-light"}`}
            onClick={() => setAutoRefresh((v) => !v)}
            title="เปิด/ปิดการอัปเดตอัตโนมัติทุก 10 วินาที"
          >
            <Radio style={{ width: 16, color: autoRefresh ? "var(--brand-700)" : "inherit" }} />
            {autoRefresh ? "อัปเดตสด (10s)" : "หยุดอัปเดตสด"}
          </button>
          <button className="button button--secondary" onClick={() => { loadLatestTelemetry(); loadTimeSeries(); }}>
            <RefreshCw style={{ width: 16 }} />รีเฟรช
          </button>
        </div>
      </div>

      {/* Farm & Plot Selector Bar */}
      <div className="registry-toolbar" style={{ flexWrap: "wrap", gap: "var(--space-3)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <label htmlFor="farm-select"><strong>สวน:</strong></label>
          <select
            id="farm-select"
            value={farmId}
            onChange={(e) => { setFarmId(e.target.value); setSelectedPlotId("all"); }}
            style={{ fontWeight: 600 }}
          >
            {farms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <label htmlFor="plot-select"><strong>แปลง/โซน:</strong></label>
          <select
            id="plot-select"
            value={selectedPlotId}
            onChange={(e) => setSelectedPlotId(e.target.value)}
          >
            <option value="all">ทุกแปลงในสวน ({plots.length} แปลง)</option>
            {plots.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <span style={{ marginLeft: "auto", fontSize: 13, color: "var(--ink-600)" }}>
          {telemetry?.retrieved_at ? `อัปเดตล่าสุด: ${new Date(telemetry.retrieved_at).toLocaleTimeString("th-TH")}` : ""}
        </span>
      </div>

      {error && <div className="form-status form-status--danger">{error}</div>}

      {loading ? (
        <div className="workspace-state"><LoaderCircle className="is-spinning" /><h2>กำลังโหลดข้อมูลตรวจวัด...</h2></div>
      ) : (
        <div style={{ display: "grid", gap: "var(--space-6)", marginTop: "var(--space-4)" }}>

          {/* Section 1: Weather Station Overview (All Weather Stations in Farm/Plot) */}
          <section className="registry-surface" style={{ padding: "var(--space-5)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)", flexWrap: "wrap", gap: "var(--space-2)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                <CloudSun style={{ color: "var(--brand-700)", width: 24, height: 24 }} />
                <div>
                  <h2 style={{ fontSize: 18, margin: 0 }}>
                    สภาพอากาศทุกแปลง ({filteredStations.length} สถานี)
                  </h2>
                  <span style={{ fontSize: 13, color: "var(--ink-600)" }}>
                    รายงานสภาพอากาศสดแยกตามแปลงและโซนเพาะปลูก
                  </span>
                </div>
              </div>
            </div>

            {filteredStations.length === 0 ? (
              <div className="registry-empty" style={{ padding: "var(--space-5)" }}>
                <CloudSun style={{ opacity: 0.4 }} />
                <p>ยังไม่มีสถานีตรวจอากาศในแปลงที่เลือก</p>
              </div>
            ) : (
              <div style={{ display: "grid", gap: "var(--space-4)" }}>
                {filteredStations.map((station) => (
                  <div
                    key={station.station_id}
                    style={{
                      background: "var(--canvas-soft)",
                      border: "1px solid var(--line-strong)",
                      borderRadius: "var(--radius-sm)",
                      padding: "var(--space-4)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-3)", flexWrap: "wrap" }}>
                      <div>
                        <strong style={{ fontSize: 16, color: "var(--ink-900)" }}>{station.display_name}</strong>
                        <span style={{ fontSize: 13, color: "var(--ink-600)", marginLeft: "8px" }}>
                          ({station.station_code} · แปลง {station.plot_name || "ไม่ระบุ"})
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
                        {station.battery_pct != null && (
                          <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: 13, color: "var(--ink-700)" }}>
                            <Battery style={{ width: 16 }} /> {station.battery_pct}%
                          </span>
                        )}
                        <span className={`registry-status ${station.status === "ONLINE" ? "registry-status--active" : "registry-status--off"}`}>
                          {station.status === "ONLINE" ? "🟢 Online" : "⚪ Offline"}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--space-3)" }}>
                      <MetricCard
                        icon={Thermometer}
                        label="อุณหภูมิอากาศ"
                        value={station.metrics?.air_temperature?.value}
                        unit="°C"
                        color="#e0633b"
                        quality={station.metrics?.air_temperature?.quality}
                        active={selectedMetric === "air_temperature"}
                        onClick={() => setSelectedMetric("air_temperature")}
                      />
                      <MetricCard
                        icon={Droplets}
                        label="ความชื้นสัมพัทธ์"
                        value={station.metrics?.air_relative_humidity?.value}
                        unit="%RH"
                        color="#1982c4"
                        quality={station.metrics?.air_relative_humidity?.quality}
                        active={selectedMetric === "air_relative_humidity"}
                        onClick={() => setSelectedMetric("air_relative_humidity")}
                      />
                      <MetricCard
                        icon={Sun}
                        label="ความเข้มแสง"
                        value={station.metrics?.illuminance?.value}
                        unit="lux"
                        color="#e89923"
                        quality={station.metrics?.illuminance?.quality}
                        active={selectedMetric === "illuminance"}
                        onClick={() => setSelectedMetric("illuminance")}
                      />
                      <MetricCard
                        icon={Wind}
                        label="ความเร็วลม"
                        value={station.metrics?.wind_speed_avg_5m?.value}
                        unit="m/s"
                        color="#6a7b82"
                        quality={station.metrics?.wind_speed_avg_5m?.quality}
                        active={selectedMetric === "wind_speed_avg_5m"}
                        onClick={() => setSelectedMetric("wind_speed_avg_5m")}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Section 2: Soil Sensors Health & Multi-Depth Grid */}
          <section className="registry-surface" style={{ padding: "var(--space-5)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)", flexWrap: "wrap", gap: "var(--space-2)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                <Leaf style={{ color: "var(--brand-700)", width: 24, height: 24 }} />
                <div>
                  <h2 style={{ fontSize: 18, margin: 0 }}>สุขภาพดินและโภชนาการ (Soil Sensors)</h2>
                  <span style={{ fontSize: 13, color: "var(--ink-600)" }}>
                    {filteredSensors.length} โพรบวัดดินในแปลง · พร้อมการชดเชยค่าสอบเทียบ (Calibrated)
                  </span>
                </div>
              </div>
            </div>

            {filteredSensors.length === 0 ? (
              <div className="registry-empty" style={{ padding: "var(--space-6)" }}>
                <Cpu />
                <h3>ยังไม่มีเซนเซอร์ดินที่ผูกในแปลงนี้</h3>
                <p>ไปยังเมนู <Link href="/devices" style={{ color: "var(--brand-700)", textDecoration: "underline" }}>อุปกรณ์</Link> เพื่อลงทะเบียน Soil Sensor และผูกการติดตั้ง</p>
              </div>
            ) : (
              <div style={{ display: "grid", gap: "var(--space-5)" }}>
                {filteredSensors.map((sensor) => {
                  const m = sensor.metrics;
                  const moisture = m.soil_moisture?.value;
                  const ph = m.soil_ph?.value;
                  const ec = m.soil_ec?.value;

                  return (
                    <div
                      key={sensor.sensor_id}
                      style={{
                        background: "var(--canvas-soft)",
                        border: "1px solid var(--line-strong)",
                        borderRadius: "var(--radius-sm)",
                        padding: "var(--space-4)",
                      }}
                    >
                      {/* Sensor Sub-header */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-3)", flexWrap: "wrap" }}>
                        <div>
                          <strong style={{ fontSize: 16, color: "var(--ink-900)" }}>{sensor.display_name}</strong>
                          <span style={{ fontSize: 13, color: "var(--ink-600)", marginLeft: "8px" }}>
                            ({sensor.sensor_code} · {sensor.sensor_type} · แปลง {sensor.plot_name || "ไม่ระบุ"})
                          </span>
                        </div>
                        {sensor.last_seen && (
                          <span style={{ fontSize: 12, color: "var(--ink-500)" }}>
                            วัดล่าสุด: {new Date(sensor.last_seen).toLocaleTimeString("th-TH")}
                          </span>
                        )}
                      </div>

                      {/* Sensor Metrics Row */}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--space-3)" }}>
                        <MetricCard
                          icon={Droplets}
                          label="ความชื้นดิน"
                          value={moisture}
                          unit="%"
                          color="#2563eb"
                          quality={m.soil_moisture?.quality}
                          badge={moisture != null ? (moisture >= 45 && moisture <= 65 ? "เหมาะสม" : moisture < 45 ? "ดินแห้ง" : "ดินแฉะ") : undefined}
                          active={selectedMetric === "soil_moisture"}
                          onClick={() => setSelectedMetric("soil_moisture")}
                        />
                        <MetricCard
                          icon={Sliders}
                          label="กรด-ด่างดิน (pH)"
                          value={ph}
                          unit="pH"
                          color="#10b981"
                          quality={m.soil_ph?.quality}
                          badge={ph != null ? (ph >= 5.5 && ph <= 6.5 ? "เหมาะสม" : ph < 5.5 ? "กรดจัด" : "ด่าง") : undefined}
                          active={selectedMetric === "soil_ph"}
                          onClick={() => setSelectedMetric("soil_ph")}
                        />
                        <MetricCard
                          icon={Zap}
                          label="การนำไฟฟ้า (EC)"
                          value={ec}
                          unit="µS/cm"
                          color="#8b5cf6"
                          quality={m.soil_ec?.quality}
                          active={selectedMetric === "soil_ec"}
                          onClick={() => setSelectedMetric("soil_ec")}
                        />
                        <MetricCard
                          icon={Thermometer}
                          label="อุณหภูมิดิน"
                          value={m.soil_temperature?.value}
                          unit="°C"
                          color="#b36200"
                          quality={m.soil_temperature?.quality}
                          active={selectedMetric === "soil_temperature"}
                          onClick={() => setSelectedMetric("soil_temperature")}
                        />
                      </div>

                      {/* NPK Breakdown Row if 7-in-1 */}
                      {sensor.sensor_type === "SOIL_7_IN_1" && (
                        <div style={{ marginTop: "var(--space-3)", padding: "var(--space-2) var(--space-3)", background: "#fff", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", display: "flex", gap: "var(--space-4)", alignItems: "center", flexWrap: "wrap" }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-700)" }}>ธาตุอาหารหลัก (NPK):</span>
                          <span style={{ fontSize: 13 }}>ไนโตรเจน (N): <strong>{m.soil_n?.value ?? "-"}</strong> mg/kg</span>
                          <span style={{ fontSize: 13 }}>ฟอสฟอรัส (P): <strong>{m.soil_p?.value ?? "-"}</strong> mg/kg</span>
                          <span style={{ fontSize: 13 }}>โพแทสเซียม (K): <strong>{m.soil_k?.value ?? "-"}</strong> mg/kg</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Section 3: Interactive Time-Series Charts */}
          <section className="registry-surface" style={{ padding: "var(--space-5)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)", flexWrap: "wrap", gap: "var(--space-3)" }}>
              <div>
                <h2 style={{ fontSize: 18, margin: 0, display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                  <LineChart style={{ color: "var(--brand-700)", width: 22 }} />
                  แนวโน้มย้อนหลัง: {METRIC_LABELS[selectedMetric]?.label || selectedMetric}
                </h2>
                <p style={{ fontSize: 13, color: "var(--ink-600)", margin: "2px 0 0" }}>
                  {METRIC_LABELS[selectedMetric]?.desc || ""}
                </p>
              </div>

              {/* Controls: Metric, Downsample Interval, Time Range */}
              <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", flexWrap: "wrap" }}>
                <select
                  value={selectedMetric}
                  onChange={(e) => setSelectedMetric(e.target.value)}
                  style={{ fontWeight: 600, padding: "6px 12px" }}
                >
                  {Object.entries(METRIC_LABELS).map(([k, item]) => (
                    <option key={k} value={k}>{item.label} ({item.unit})</option>
                  ))}
                </select>

                <select
                  value={seriesInterval}
                  onChange={(e) => setSeriesInterval(e.target.value as "auto" | "raw" | "5m" | "15m" | "1h" | "1d")}
                  style={{ fontSize: 13, padding: "6px 10px" }}
                  title="ความละเอียดของการเฉลี่ยจุดข้อมูล"
                >
                  <option value="auto">🤖 ปรับความละเอียดอัตโนมัติ (แนะนำ)</option>
                  <option value="15m">⏱️ เฉลี่ยทุก 15 นาที (แนะนำ 24 ชม.)</option>
                  <option value="1h">⏱️ เฉลี่ยทุก 1 ชั่วโมง (แนะนำ 7 วัน)</option>
                  <option value="1d">📅 เฉลี่ยทุก 1 วัน (แนะนำ 30 วัน)</option>
                  <option value="5m">⚡ เฉลี่ยทุก 5 นาที</option>
                  <option value="raw">🔥 ข้อมูลดิบ (ทุก 10 วินาที)</option>
                </select>

                <div className="button-group" style={{ display: "flex", border: "1px solid var(--line-strong)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
                  {(["24h", "7d", "30d"] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setTimeRange(r)}
                      style={{
                        padding: "6px 12px",
                        border: 0,
                        background: timeRange === r ? "var(--brand-700)" : "#fff",
                        color: timeRange === r ? "#fff" : "var(--ink-800)",
                        cursor: "pointer",
                        fontWeight: 600,
                        fontSize: 13,
                      }}
                    >
                      {r === "24h" ? "24 ชม." : r === "7d" ? "7 วัน" : "30 วัน"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Chart Area */}
            {seriesLoading ? (
              <div style={{ height: 260, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <LoaderCircle className="is-spinning" />
              </div>
            ) : !seriesData || seriesData.points.length === 0 ? (
              <div style={{ height: 200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--ink-500)" }}>
                <LineChart style={{ width: 40, height: 40, opacity: 0.3 }} />
                <p style={{ marginTop: "var(--space-2)" }}>ยังไม่มีข้อมูลตรวจวัดสำหรับพารามิเตอร์นี้ในช่วงเวลาที่เลือก</p>
              </div>
            ) : (
              <div>
                <SimpleSvgChart
                  points={seriesData.points}
                  unit={METRIC_LABELS[selectedMetric]?.unit || seriesData.unit}
                  color={METRIC_LABELS[selectedMetric]?.color || "#2563eb"}
                />

                {/* Min / Avg / Max Summary Footnotes */}
                <div style={{ display: "flex", gap: "var(--space-4)", marginTop: "var(--space-3)", paddingTop: "var(--space-3)", borderTop: "1px solid var(--line)", fontSize: 13, color: "var(--ink-700)", flexWrap: "wrap" }}>
                  {(() => {
                    const validVals = seriesData.points.map((p) => p.value).filter((v): v is number => v != null);
                    if (validVals.length === 0) return null;
                    const min = Math.min(...validVals);
                    const max = Math.max(...validVals);
                    const avg = validVals.reduce((a, b) => a + b, 0) / validVals.length;
                    const unit = METRIC_LABELS[selectedMetric]?.unit || seriesData.unit;
                    const intervalLabel =
                      effectiveInterval === "15m" ? "เฉลี่ยทุก 15 นาที" :
                      effectiveInterval === "1h" ? "เฉลี่ยทุก 1 ชั่วโมง" :
                      effectiveInterval === "1d" ? "เฉลี่ยทุก 1 วัน" :
                      effectiveInterval === "5m" ? "เฉลี่ยทุก 5 นาที" : "ข้อมูลดิบ";

                    return (
                      <>
                        <span>แสดง <strong>{validVals.length}</strong> จุดข้อมูล ({intervalLabel})</span>
                        <span>ต่ำสุด: <strong style={{ color: "#2563eb" }}>{min.toFixed(1)} {unit}</strong></span>
                        <span>เฉลี่ย: <strong>{avg.toFixed(1)} {unit}</strong></span>
                        <span>สูงสุด: <strong style={{ color: "#e0633b" }}>{max.toFixed(1)} {unit}</strong></span>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </section>

        </div>
      )}
    </>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  unit,
  color,
  quality,
  badge,
  active = false,
  onClick,
}: {
  icon: typeof Thermometer;
  label: string;
  value?: number | null;
  unit: string;
  color: string;
  quality?: string;
  badge?: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: "#fff",
        border: active ? `2px solid ${color}` : "1px solid var(--line)",
        borderRadius: "var(--radius-sm)",
        padding: "var(--space-3) var(--space-4)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        cursor: onClick ? "pointer" : "default",
        transition: "box-shadow 0.15s, border-color 0.15s",
        boxShadow: active ? "0 4px 12px rgba(0,0,0,0.06)" : "none",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <span style={{ fontSize: 13, color: "var(--ink-600)", fontWeight: 600 }}>{label}</span>
        <Icon style={{ width: 18, height: 18, color }} />
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: "6px", margin: "var(--space-2) 0 4px" }}>
        <strong style={{ fontSize: 24, color: "var(--ink-950)", fontFamily: "monospace" }}>
          {value != null ? value.toFixed(1) : "--"}
        </strong>
        <span style={{ fontSize: 13, color: "var(--ink-600)" }}>{unit}</span>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11 }}>
        {badge ? (
          <span style={{
            background: badge === "เหมาะสม" ? "var(--brand-100)" : "#fee2e2",
            color: badge === "เหมาะสม" ? "var(--brand-800)" : "#b91c1c",
            padding: "2px 6px",
            borderRadius: 4,
            fontWeight: 700,
          }}>
            {badge}
          </span>
        ) : quality && quality !== "valid" ? (
          <span style={{ color: quality === "calculated" ? "#2563eb" : "#d97706", fontWeight: 600 }}>
            {quality === "calculated" ? "สูตรสอบเทียบ" : quality}
          </span>
        ) : (
          <span style={{ color: "var(--ink-500)" }}>ปกติ</span>
        )}
        {onClick && <span style={{ color: "var(--brand-700)", fontSize: 11 }}>ดูกราฟ &rarr;</span>}
      </div>
    </div>
  );
}

function SimpleSvgChart({
  points,
  unit,
  color,
}: {
  points: TimeSeriesPoint[];
  unit: string;
  color: string;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const rawValidPoints = useMemo(() => points.filter((p) => p.value != null), [points]);

  // Apply Moving Average smoothing if points are dense (> 40 points)
  const validPoints = useMemo(() => {
    if (rawValidPoints.length <= 40) return rawValidPoints;
    
    // Apply 3-point rolling moving average for smooth agronomic trend
    return rawValidPoints.map((p, idx) => {
      if (idx === 0 || idx === rawValidPoints.length - 1) return p;
      const prev = rawValidPoints[idx - 1].value as number;
      const curr = p.value as number;
      const next = rawValidPoints[idx + 1].value as number;
      const smoothedVal = (prev + curr * 2 + next) / 4;
      return {
        ...p,
        value: roundTo(smoothedVal, 2),
      };
    });
  }, [rawValidPoints]);

  if (validPoints.length < 2) {
    return (
      <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-500)" }}>
        {validPoints.length === 1
          ? `มีข้อมูลจุดเดียวยังไม่พอวาดเส้นกราฟ (${validPoints[0]?.value} ${unit})`
          : "ไม่มีข้อมูลสำหรับแสดงผล"}
      </div>
    );
  }

  const values = validPoints.map((p) => p.value as number);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const paddingVal = (maxVal - minVal) * 0.12 || 1.0;
  const chartMin = minVal - paddingVal;
  const chartMax = maxVal + paddingVal;
  const valRange = chartMax - chartMin || 1;

  const width = 860;
  const height = 260;
  const padLeft = 48;
  const padRight = 24;
  const padTop = 20;
  const padBottom = 35;

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;
  const yBottom = height - padBottom;

  // Calculate coordinates for each point
  const coords = validPoints.map((p, idx) => {
    const x = padLeft + (idx / (validPoints.length - 1)) * chartW;
    const y = padTop + chartH - (((p.value as number) - chartMin) / valRange) * chartH;
    return { x, y, point: p };
  });

  // Generate Smooth Catmull-Rom / Bézier Curve Path
  const makeSmoothPath = (pts: typeof coords) => {
    if (pts.length === 0) return "";
    let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d;
  };

  const linePath = makeSmoothPath(coords);
  const areaPath = `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${yBottom} L ${coords[0].x.toFixed(1)} ${yBottom} Z`;
  const gradientId = `chart-gradient-${color.replace(/[^a-zA-Z0-9]/g, "")}`;

  // Handle Mouse Move over SVG
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * width;

    // Find closest point by X coordinate
    let closestIdx = 0;
    let minDistance = Infinity;
    coords.forEach((c, idx) => {
      const dist = Math.abs(c.x - svgX);
      if (dist < minDistance) {
        minDistance = dist;
        closestIdx = idx;
      }
    });
    setHoverIndex(closestIdx);
  };

  const activeCoord = hoverIndex != null ? coords[hoverIndex] : null;

  return (
    <div style={{ width: "100%", position: "relative", overflowX: "auto" }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: "100%", height: "auto", minWidth: 480, cursor: "crosshair" }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverIndex(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.32" />
            <stop offset="70%" stopColor={color} stopOpacity="0.08" />
            <stop offset="100%" stopColor={color} stopOpacity="0.00" />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor={color} floodOpacity="0.3" />
          </filter>
        </defs>

        {/* Horizontal Grid lines */}
        <line x1={padLeft} y1={padTop} x2={width - padRight} y2={padTop} stroke="#e5e7eb" strokeDasharray="4 4" />
        <line x1={padLeft} y1={padTop + chartH * 0.33} x2={width - padRight} y2={padTop + chartH * 0.33} stroke="#f3f4f6" strokeDasharray="4 4" />
        <line x1={padLeft} y1={padTop + chartH * 0.66} x2={width - padRight} y2={padTop + chartH * 0.66} stroke="#f3f4f6" strokeDasharray="4 4" />
        <line x1={padLeft} y1={yBottom} x2={width - padRight} y2={yBottom} stroke="#d1d5db" strokeWidth="1.2" />

        {/* Y-Axis Value Labels */}
        <text x={padLeft - 8} y={padTop + 4} textAnchor="end" fontSize="11" fill="#4b5563" fontWeight="500">
          {maxVal.toFixed(1)}
        </text>
        <text x={padLeft - 8} y={padTop + chartH / 2 + 4} textAnchor="end" fontSize="11" fill="#6b7280">
          {((maxVal + minVal) / 2).toFixed(1)}
        </text>
        <text x={padLeft - 8} y={yBottom + 3} textAnchor="end" fontSize="11" fill="#4b5563" fontWeight="500">
          {minVal.toFixed(1)}
        </text>

        {/* X-Axis Time Labels (First, Quarter, Middle, 3/4, Last) */}
        {validPoints.length > 0 && (
          <>
            <text x={coords[0].x} y={height - 12} textAnchor="start" fontSize="11" fill="#6b7280">
              {formatTime(validPoints[0].timestamp)}
            </text>
            <text x={coords[Math.floor(coords.length * 0.33)].x} y={height - 12} textAnchor="middle" fontSize="11" fill="#6b7280">
              {formatTime(validPoints[Math.floor(validPoints.length * 0.33)].timestamp)}
            </text>
            <text x={coords[Math.floor(coords.length * 0.66)].x} y={height - 12} textAnchor="middle" fontSize="11" fill="#6b7280">
              {formatTime(validPoints[Math.floor(validPoints.length * 0.66)].timestamp)}
            </text>
            <text x={coords[coords.length - 1].x} y={height - 12} textAnchor="end" fontSize="11" fill="#6b7280">
              {formatTime(validPoints[validPoints.length - 1].timestamp)}
            </text>
          </>
        )}

        {/* Shaded Area Beneath Smooth Curve */}
        <path d={areaPath} fill={`url(#${gradientId})`} />

        {/* Smooth Curved Spline Line */}
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#glow)"
        />

        {/* Sample Point Dots (spaced out if dense) */}
        {coords.map((c, idx) => {
          const sampleInterval = Math.max(1, Math.floor(coords.length / 12));
          const isSample = idx === 0 || idx === coords.length - 1 || idx % sampleInterval === 0;
          if (!isSample && hoverIndex !== idx) return null;
          const isHovered = hoverIndex === idx;
          return (
            <g key={idx}>
              <circle
                cx={c.x}
                cy={c.y}
                r={isHovered ? "6" : "3.5"}
                fill={isHovered ? color : "#ffffff"}
                stroke={color}
                strokeWidth={isHovered ? "3" : "2"}
                style={{ transition: "all 0.15s ease-out" }}
              />
              {isHovered && (
                <circle
                  cx={c.x}
                  cy={c.y}
                  r="10"
                  fill="none"
                  stroke={color}
                  strokeWidth="1.5"
                  strokeOpacity="0.4"
                />
              )}
            </g>
          );
        })}

        {/* Active Hover Crosshair Line */}
        {activeCoord && (
          <line
            x1={activeCoord.x}
            y1={padTop}
            x2={activeCoord.x}
            y2={yBottom}
            stroke={color}
            strokeWidth="1.2"
            strokeDasharray="3 3"
            strokeOpacity="0.7"
          />
        )}
      </svg>

      {/* Floating Hover Tooltip Box */}
      {activeCoord && (
        <div
          style={{
            position: "absolute",
            left: `${(activeCoord.x / width) * 100}%`,
            top: `${(activeCoord.y / height) * 100}%`,
            transform: activeCoord.x > width * 0.65 ? "translate(-105%, -115%)" : "translate(10%, -115%)",
            background: "rgba(17, 24, 39, 0.94)",
            color: "#ffffff",
            padding: "8px 12px",
            borderRadius: "6px",
            fontSize: "12px",
            pointerEvents: "none",
            zIndex: 20,
            whiteSpace: "nowrap",
            boxShadow: "0 6px 18px rgba(0,0,0,0.22)",
            backdropFilter: "blur(4px)",
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          <div style={{ color: "#9ca3af", fontSize: "11px", marginBottom: "2px" }}>
            🕒 {new Date(activeCoord.point.timestamp).toLocaleString("th-TH", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
            <span style={{ fontSize: "15px", fontWeight: 700, color: "#ffffff", fontFamily: "monospace" }}>
              {activeCoord.point.value?.toFixed(1)}
            </span>
            <span style={{ color: "#d1d5db" }}>{unit}</span>
          </div>
          {activeCoord.point.quality && activeCoord.point.quality !== "valid" && (
            <div style={{ marginTop: "4px", fontSize: "10px", color: activeCoord.point.quality === "calculated" ? "#60a5fa" : "#f87171" }}>
              {activeCoord.point.quality === "calculated" ? "✦ สูตรสอบเทียบ (Calibrated)" : `สถานะ: ${activeCoord.point.quality}`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function roundTo(val: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

function formatTime(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    return d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return isoStr;
  }
}
