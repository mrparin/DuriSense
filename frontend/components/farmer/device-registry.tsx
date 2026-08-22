"use client";

import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CloudSun,
  Copy,
  Cpu,
  ExternalLink,
  History,
  Info,
  KeyRound,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Sliders,
  Unplug,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";

type Farm = { id: string; name: string };
type Plot = { id: string; name: string };
type Device = {
  id: string;
  farm_id: string;
  plot_id?: string | null;
  device_code: string;
  display_name: string;
  kind: "WEATHER_STATION" | "SOIL_SENSOR";
  status: "ACTIVE" | "DECOMMISSIONED";
  firmware_version?: string | null;
  sensor_type?: "SOIL_TH" | "SOIL_7_IN_1" | null;
  modbus_address?: number | null;
  model?: string | null;
  serial_number?: string | null;
};

type Assignment = {
  id: string;
  sensor_id: string;
  station_id: string;
  plot_id: string;
  valid_from: string;
  valid_to?: string | null;
  installation_depth_cm?: number | null;
  note?: string | null;
};

type Calibration = {
  id: string;
  sensor_id: string;
  calibrated_at: string;
  formula_type?: string | null;
  offset_value?: number | null;
  scale_factor?: number | null;
  temperature_compensation: boolean;
  notes?: string | null;
};

type Credential = { device_id: string; secret: string; message: string };
type ViewState = "loading" | "ready" | "unauthorized" | "error";

export function DeviceRegistry() {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [farmId, setFarmId] = useState("");
  const [plots, setPlots] = useState<Plot[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [state, setState] = useState<ViewState>("loading");
  const [showForm, setShowForm] = useState<"station" | "sensor" | null>(null);
  const [showAssignment, setShowAssignment] = useState(false);
  const [showDecommissioned, setShowDecommissioned] = useState(false);
  const [credential, setCredential] = useState<Credential | null>(null);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [calibrationSensor, setCalibrationSensor] = useState<Device | null>(null);
  const [showCalGuide, setShowCalGuide] = useState(true);
  const [calibrations, setCalibrations] = useState<Calibration[]>([]);
  const [calibrationsLoading, setCalibrationsLoading] = useState(false);
  const [historySensor, setHistorySensor] = useState<Device | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [workingId, setWorkingId] = useState<string | null>(null);

  const loadFarms = useCallback(async () => {
    setState("loading");
    try {
      const items = await apiFetch<Farm[]>("/farms");
      setFarms(items);
      setFarmId((current) => current && items.some((farm) => farm.id === current) ? current : items[0]?.id ?? "");
      setState("ready");
    } catch (reason) { setState(reason instanceof ApiError && reason.status === 401 ? "unauthorized" : "error"); }
  }, []);

  const loadRegistry = useCallback(async (selected: string) => {
    if (!selected) { setPlots([]); setDevices([]); return; }
    try {
      const [plotItems, deviceItems] = await Promise.all([
        apiFetch<Plot[]>(`/farms/${selected}/plots`),
        apiFetch<Device[]>(`/devices?farm_id=${selected}&include_decommissioned=true`),
      ]);
      setPlots(plotItems);
      setDevices(deviceItems);
    } catch { setError("โหลดทะเบียนอุปกรณ์ไม่สำเร็จ"); }
  }, []);

  useEffect(() => {
    let cancelled = false;
    apiFetch<Farm[]>("/farms")
      .then((items) => {
        if (cancelled) return;
        setFarms(items);
        setFarmId(items[0]?.id ?? "");
        setState("ready");
      })
      .catch((reason) => {
        if (!cancelled) setState(reason instanceof ApiError && reason.status === 401 ? "unauthorized" : "error");
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!farmId) return;
    let cancelled = false;
    Promise.all([
      apiFetch<Plot[]>(`/farms/${farmId}/plots`),
      apiFetch<Device[]>(`/devices?farm_id=${farmId}&include_decommissioned=true`),
    ])
      .then(([plotItems, deviceItems]) => {
        if (cancelled) return;
        setPlots(plotItems);
        setDevices(deviceItems);
      })
      .catch(() => { if (!cancelled) setError("โหลดทะเบียนอุปกรณ์ไม่สำเร็จ"); });
    return () => { cancelled = true; };
  }, [farmId]);

  async function createDevice(event: FormEvent<HTMLFormElement>, kind: "station" | "sensor") {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setError("");
    const common = {
      farm_id: farmId,
      plot_id: form.get("plot_id") || null,
      device_code: form.get("device_code"),
      display_name: form.get("display_name"),
      firmware_version: form.get("firmware_version") || null,
    };
    try {
      const item = kind === "station"
        ? await apiFetch<Device>("/weather-stations", { method: "POST", body: JSON.stringify({ ...common, model: form.get("model") || null, serial_number: form.get("serial_number") || null }) })
        : await apiFetch<Device>("/soil-sensors", { method: "POST", body: JSON.stringify({ ...common, sensor_type: form.get("sensor_type"), modbus_address: form.get("modbus_address") ? Number(form.get("modbus_address")) : null }) });
      setDevices((current) => [...current, item]);
      setShowForm(null);
      setNotice(`ลงทะเบียน “${item.display_name}” แล้ว`);
      formElement.reset();
    } catch (reason) { setError(reason instanceof ApiError ? reason.body.message : "ลงทะเบียนอุปกรณ์ไม่สำเร็จ"); }
  }

  async function updateDevice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingDevice) return;
    const form = new FormData(event.currentTarget);
    setError("");
    try {
      const updated = await apiFetch<Device>(`/devices/${editingDevice.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          display_name: form.get("display_name"),
          plot_id: form.get("plot_id") || null,
          firmware_version: form.get("firmware_version") || null,
        }),
      });
      setDevices((current) => current.map((d) => d.id === updated.id ? updated : d));
      setEditingDevice(null);
      setNotice(`แก้ไขข้อมูล “${updated.display_name}” แล้ว`);
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.body.message : "แก้ไขข้อมูลอุปกรณ์ไม่สำเร็จ");
    }
  }

  async function assignSensor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError("");
    try {
      await apiFetch("/sensor-assignments", { method: "POST", body: JSON.stringify({
        sensor_id: form.get("sensor_id"), station_id: form.get("station_id"), plot_id: form.get("plot_id"),
        installation_depth_cm: form.get("installation_depth_cm") ? Number(form.get("installation_depth_cm")) : null,
        note: form.get("note") || null,
      }) });
      setNotice("บันทึกการติดตั้งเซนเซอร์และประวัติ assignment แล้ว");
      setShowAssignment(false);
      await loadRegistry(farmId);
    } catch (reason) { setError(reason instanceof ApiError ? reason.body.message : "บันทึก assignment ไม่สำเร็จ"); }
  }

  async function openCalibration(sensor: Device) {
    setCalibrationSensor(sensor);
    setCalibrationsLoading(true);
    try {
      const items = await apiFetch<Calibration[]>(`/soil-sensors/${sensor.id}/calibrations`);
      setCalibrations(items);
    } catch {
      setError("โหลดประวัติการสอบเทียบไม่สำเร็จ");
    } finally {
      setCalibrationsLoading(false);
    }
  }

  async function createCalibration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!calibrationSensor) return;
    const form = new FormData(event.currentTarget);
    setError("");
    try {
      const cal = await apiFetch<Calibration>(`/soil-sensors/${calibrationSensor.id}/calibrations`, {
        method: "POST",
        body: JSON.stringify({
          formula_type: form.get("formula_type") || "LINEAR",
          offset_value: form.get("offset_value") ? Number(form.get("offset_value")) : 0,
          scale_factor: form.get("scale_factor") ? Number(form.get("scale_factor")) : 1,
          temperature_compensation: form.get("temperature_compensation") === "true",
          notes: form.get("notes") || null,
        }),
      });
      setCalibrations((current) => [cal, ...current]);
      setNotice(`บันทึกการสอบเทียบเซนเซอร์ “${calibrationSensor.display_name}” แล้ว`);
      (event.target as HTMLFormElement).reset();
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.body.message : "บันทึกการสอบเทียบไม่สำเร็จ");
    }
  }

  async function openHistory(sensor: Device) {
    setHistorySensor(sensor);
    setAssignmentsLoading(true);
    try {
      const items = await apiFetch<Assignment[]>(`/sensor-assignments?sensor_id=${sensor.id}`);
      setAssignments(items);
    } catch {
      setError("โหลดประวัติ assignment ไม่สำเร็จ");
    } finally {
      setAssignmentsLoading(false);
    }
  }

  async function issueCredential(device: Device) {
    setWorkingId(device.id);
    setCredential(null);
    try {
      setCredential(await apiFetch<Credential>(`/weather-stations/${device.id}/credentials`, { method: "POST" }));
    } catch (reason) { setError(reason instanceof ApiError ? reason.body.message : "ออก credential ไม่สำเร็จ"); }
    finally { setWorkingId(null); }
  }

  async function decommission(device: Device) {
    const reason = window.prompt(`ระบุเหตุผลที่ยกเลิกการใช้งาน ${device.display_name}`);
    if (!reason || reason.trim().length < 3) return;
    if (!window.confirm("อุปกรณ์จะหยุดใช้งาน credential และปิด assignment ปัจจุบัน ดำเนินการต่อหรือไม่")) return;
    setWorkingId(device.id);
    try {
      await apiFetch(`/devices/${device.id}`, { method: "DELETE", body: JSON.stringify({ reason }) });
      setCredential((current) => current?.device_id === device.id ? null : current);
      setNotice(`ยกเลิกการใช้งาน “${device.display_name}” แล้ว โดยยังเก็บประวัติไว้`);
      await loadRegistry(farmId);
    } catch (reasonValue) { setError(reasonValue instanceof ApiError ? reasonValue.body.message : "ยกเลิกอุปกรณ์ไม่สำเร็จ"); }
    finally { setWorkingId(null); }
  }

  if (state === "loading") return <RegistryState icon={LoaderCircle} title="กำลังโหลดทะเบียนอุปกรณ์" spinning />;
  if (state === "unauthorized") return <RegistryState icon={AlertCircle} title="กรุณาเข้าสู่ระบบ" action={<Link className="button button--primary" href="/login">เข้าสู่ระบบ</Link>} danger />;
  if (state === "error") return <RegistryState icon={AlertCircle} title="โหลดทะเบียนไม่สำเร็จ" action={<button className="button button--secondary" onClick={loadFarms}><RefreshCw />ลองอีกครั้ง</button>} danger />;

  const activeStations = devices.filter((item) => item.kind === "WEATHER_STATION" && item.status === "ACTIVE");
  const activeSensors = devices.filter((item) => item.kind === "SOIL_SENSOR" && item.status === "ACTIVE");
  const decommissionedDevices = devices.filter((item) => item.status === "DECOMMISSIONED");

  return (
    <>
      <div className="workspace-heading">
        <div><p className="eyebrow">Device registry</p><h1>ทะเบียนอุปกรณ์</h1><p>ลงทะเบียน Weather Station และ Soil Sensor ด้วยรหัสที่ตรวจสอบย้อนกลับได้ พร้อมประวัติการติดตั้ง สอบเทียบ และยกเลิกใช้งาน</p></div>
        <div className="workspace-heading__actions">
          <button className="button button--secondary" onClick={() => { setShowForm("sensor"); setEditingDevice(null); }}><Plus />เพิ่มเซนเซอร์</button>
          <button className="button button--primary" onClick={() => { setShowForm("station"); setEditingDevice(null); }}><Plus />เพิ่มสถานี</button>
        </div>
      </div>

      <div className="registry-toolbar">
        <label htmlFor="device-farm">บริบทสวน</label>
        <select id="device-farm" value={farmId} onChange={(event) => { setFarmId(event.target.value); setShowDecommissioned(false); setCredential(null); setEditingDevice(null); setCalibrationSensor(null); setHistorySensor(null); }}>
          {farms.map((farm) => <option value={farm.id} key={farm.id}>{farm.name}</option>)}
        </select>
        <span>{activeStations.length} สถานี · {activeSensors.length} เซนเซอร์ที่ใช้งาน</span>
        {decommissionedDevices.length > 0 && (
          <button className="button button--secondary registry-history-toggle" type="button" aria-expanded={showDecommissioned} aria-controls="decommissioned-devices" onClick={() => setShowDecommissioned((value) => !value)}>
            <History aria-hidden="true" />{showDecommissioned ? "ซ่อนประวัติ" : `แสดงประวัติ (${decommissionedDevices.length})`}
          </button>
        )}
      </div>

      {notice && <div className="form-status form-status--success" role="status"><CheckCircle2 /><div><strong>{notice}</strong></div></div>}
      {error && <div className="form-status form-status--danger" role="alert"><AlertCircle /><div><strong>{error}</strong></div></div>}

      {showForm && <DeviceForm kind={showForm} plots={plots} onSubmit={createDevice} onCancel={() => setShowForm(null)} />}

      {editingDevice && (
        <form className="registry-form" onSubmit={updateDevice}>
          <div className="registry-form__heading">
            <div>
              <p className="eyebrow">Edit device</p>
              <h2>แก้ไขข้อมูล “{editingDevice.display_name}” ({editingDevice.device_code})</h2>
            </div>
            <button className="text-action" type="button" onClick={() => setEditingDevice(null)}>ปิด</button>
          </div>
          <div className="registry-form__grid">
            <div className="form-field"><label htmlFor="edit-device-name">ชื่อเรียก</label><input id="edit-device-name" name="display_name" defaultValue={editingDevice.display_name} required /></div>
            <div className="form-field"><label htmlFor="edit-device-plot">แปลงติดตั้ง</label><select id="edit-device-plot" name="plot_id" defaultValue={editingDevice.plot_id || ""}><option value="">ยังไม่กำหนด</option>{plots.map((plot) => <option key={plot.id} value={plot.id}>{plot.name}</option>)}</select></div>
            <div className="form-field"><label htmlFor="edit-firmware">Firmware version</label><input id="edit-firmware" name="firmware_version" defaultValue={editingDevice.firmware_version || ""} /></div>
          </div>
          <div className="registry-form__actions">
            <button className="button button--primary" type="submit">บันทึกการแก้ไข</button>
            <button className="button button--secondary" type="button" onClick={() => setEditingDevice(null)}>ยกเลิก</button>
          </div>
        </form>
      )}

      {calibrationSensor && (
        <section className="registry-form" style={{ marginTop: "var(--space-6)" }}>
          <div className="registry-form__heading">
            <div>
              <p className="eyebrow">Calibration metadata</p>
              <h2>การสอบเทียบเซนเซอร์: {calibrationSensor.display_name} ({calibrationSensor.device_code})</h2>
              <p style={{ color: "var(--ink-600)", margin: "4px 0 0" }}>บันทึกค่าชดเชย (offset/scale) เพื่อความถูกต้องของข้อมูลตามมาตรฐาน</p>
            </div>
            <button className="text-action" type="button" onClick={() => setCalibrationSensor(null)}>ปิด</button>
          </div>

          {/* Collapsible calibration guide box */}
          <div style={{ padding: "var(--space-4)", background: "var(--canvas-soft)", border: "1px solid var(--line-strong)", borderRadius: "var(--radius-sm)", marginBottom: "var(--space-5)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={() => setShowCalGuide((v) => !v)}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontWeight: 750, color: "var(--brand-800)" }}>
                <Info style={{ width: 18 }} />
                <span>คำแนะนำวิธีเลือกสูตรสอบเทียบและการคำนวณ</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                <Link href="/guide#calibration" target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: 13, color: "var(--brand-700)", textDecoration: "underline" }} onClick={(e) => e.stopPropagation()}>
                  <BookOpen style={{ width: 14 }} />อ่านคู่มือฉบับเต็ม <ExternalLink style={{ width: 12 }} />
                </Link>
                <button type="button" style={{ border: 0, background: "transparent", cursor: "pointer", padding: "2px" }} aria-label="Toggle guide">
                  {showCalGuide ? <ChevronUp style={{ width: 18 }} /> : <ChevronDown style={{ width: 18 }} />}
                </button>
              </div>
            </div>

            {showCalGuide && (
              <div style={{ marginTop: "var(--space-3)", fontSize: 14, lineHeight: 1.6, color: "var(--ink-800)", borderTop: "1px solid var(--line)", paddingTop: "var(--space-3)" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "var(--space-4)" }}>
                  <div style={{ background: "#fff", padding: "var(--space-3)", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)" }}>
                    <strong style={{ color: "var(--brand-800)" }}>1. ทดสอบน้ำยา 1 ค่า (Offset Only / ชดเชยคงที่):</strong>
                    <p style={{ margin: "4px 0", color: "var(--ink-600)" }}>เหมาะสำหรับปรับแก้ค่าเบี่ยงเบนคงที่ เช่น น้ำยา pH 7.00 หรือ EC 1413 µS/cm</p>
                    <ul style={{ margin: "4px 0 0", paddingLeft: "var(--space-4)" }}>
                      <li><strong>สูตร:</strong> <code>y = x + b</code> (Scale a = 1.0)</li>
                      <li><strong>คำนวณ Offset (b):</strong> <code>ค่าน้ำยาจริง - ค่าที่อ่านได้</code></li>
                      <li><em>ตัวอย่าง:</em> น้ำยา pH 7.00 เซนเซอร์อ่านได้ 6.80 &rarr; ใส่ <code>Offset = +0.20</code></li>
                    </ul>
                  </div>

                  <div style={{ background: "#fff", padding: "var(--space-3)", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)" }}>
                    <strong style={{ color: "var(--brand-800)" }}>2. ทดสอบน้ำยา 2 ค่า (Linear: y = ax + b):</strong>
                    <p style={{ margin: "4px 0", color: "var(--ink-600)" }}>ความแม่นยำสูงตลอดช่วง เช่น น้ำยา pH 4.01 และ pH 7.00</p>
                    <ul style={{ margin: "4px 0 0", paddingLeft: "var(--space-4)" }}>
                      <li><strong>Scale (a):</strong> <code>(ค่าน้ำยา2 - ค่าน้ำยา1) / (ค่าอ่าน2 - ค่าอ่าน1)</code></li>
                      <li><strong>Offset (b):</strong> <code>ค่าน้ำยา1 - (a × ค่าอ่าน1)</code></li>
                      <li><strong>ชดเชยอุณหภูมิ:</strong> เปิดใช้งานเมื่อต้องการปรับเทียบที่ 25°C</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>

          <form className="registry-form registry-form--nested" onSubmit={createCalibration} style={{ marginBottom: "var(--space-6)" }}>
            <div className="registry-form__grid">
              <div className="form-field"><label htmlFor="formula-type">สูตรสอบเทียบ (Formula)</label><select id="formula-type" name="formula_type"><option value="LINEAR">เชิงเส้น (Linear: y = ax + b)</option><option value="OFFSET_ONLY">ชดเชยค่าคงที่ (Offset only: y = x + b)</option><option value="POLYNOMIAL">พหุนาม (Polynomial)</option></select></div>
              <div className="form-field"><label htmlFor="scale-factor">Scale factor (a) <small style={{ color: "var(--ink-500)" }}>(ค่าเริ่มต้น 1.0)</small></label><input id="scale-factor" name="scale_factor" type="number" step="0.0001" defaultValue="1.0" /></div>
              <div className="form-field"><label htmlFor="offset-value">Offset value (b) <small style={{ color: "var(--ink-500)" }}>(ค่าน้ำยา - ค่าที่อ่านได้)</small></label><input id="offset-value" name="offset_value" type="number" step="0.0001" defaultValue="0.0" /></div>
              <div className="form-field"><label htmlFor="temp-comp">การชดเชยอุณหภูมิ</label><select id="temp-comp" name="temperature_compensation"><option value="false">ปิด (No compensation)</option><option value="true">เปิด (Temperature compensated)</option></select></div>
              <div className="form-field registry-form__wide"><label htmlFor="cal-notes">บันทึก/สารมาตรฐานที่ใช้</label><input id="cal-notes" name="notes" placeholder="เช่น สารละลายมาตรฐาน pH 7.00 Lot 2026/08, ค่าความชื้นอิ่มตัว" /></div>
            </div>
            <button className="button button--primary" type="submit">บันทึกผลการสอบเทียบ</button>
          </form>

          <div>
            <h3>ประวัติการสอบเทียบ</h3>
            {calibrationsLoading ? (
              <p style={{ color: "var(--ink-600)" }}>กำลังโหลดประวัติ...</p>
            ) : calibrations.length === 0 ? (
              <p style={{ color: "var(--ink-600)" }}>ยังไม่มีประวัติการสอบเทียบสำหรับเซนเซอร์นี้</p>
            ) : (
              <div style={{ display: "grid", gap: "var(--space-2)", marginTop: "var(--space-3)" }}>
                {calibrations.map((cal) => (
                  <div key={cal.id} style={{ padding: "var(--space-3) var(--space-4)", background: "var(--canvas-soft)", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <strong>{new Date(cal.calibrated_at).toLocaleString("th-TH")}</strong> — {cal.formula_type || "LINEAR"} (Scale: {cal.scale_factor ?? 1}, Offset: {cal.offset_value ?? 0})
                      {cal.notes && <p style={{ margin: "2px 0 0", color: "var(--ink-600)", fontSize: 13 }}>{cal.notes}</p>}
                    </div>
                    {cal.temperature_compensation && <span className="registry-status registry-status--active" style={{ fontSize: 12 }}>Temp comp</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {historySensor && (
        <section className="registry-form" style={{ marginTop: "var(--space-6)" }}>
          <div className="registry-form__heading">
            <div>
              <p className="eyebrow">Assignment history</p>
              <h2>ประวัติการติดตั้ง: {historySensor.display_name} ({historySensor.device_code})</h2>
            </div>
            <button className="text-action" type="button" onClick={() => setHistorySensor(null)}>ปิด</button>
          </div>
          {assignmentsLoading ? (
            <p style={{ color: "var(--ink-600)" }}>กำลังโหลดประวัติการติดตั้ง...</p>
          ) : assignments.length === 0 ? (
            <p style={{ color: "var(--ink-600)" }}>ยังไม่มีประวัติการติดตั้ง</p>
          ) : (
            <div style={{ display: "grid", gap: "var(--space-2)" }}>
              {assignments.map((item) => {
                const p = plots.find((x) => x.id === item.plot_id)?.name || "ไม่ทราบแปลง";
                const st = devices.find((x) => x.id === item.station_id)?.display_name || "ไม่ทราบสถานี";
                return (
                  <div key={item.id} style={{ padding: "var(--space-3) var(--space-4)", background: "var(--canvas-soft)", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong>สถานี: {st} · แปลง: {p}</strong>
                      <span className={`registry-status${item.valid_to ? "" : " registry-status--active"}`}>
                        {item.valid_to ? "ปิดช่วงแล้ว" : "ติดตั้งปัจจุบัน"}
                      </span>
                    </div>
                    <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--ink-600)" }}>
                      ตั้งแต่ {new Date(item.valid_from).toLocaleString("th-TH")} {item.valid_to ? `ถึง ${new Date(item.valid_to).toLocaleString("th-TH")}` : ""} {item.installation_depth_cm != null ? `· ความลึก ${item.installation_depth_cm} ซม.` : ""}
                    </p>
                    {item.note && <small style={{ color: "var(--ink-700)" }}>{item.note}</small>}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {credential && (
        <div className="credential-result" role="status">
          <KeyRound />
          <div>
            <strong>คัดลอก credential ตอนนี้</strong>
            <p>ระบบจัดเก็บเฉพาะ hash และจะไม่แสดง secret นี้ซ้ำ</p>
            <code>{credential.secret}</code>
          </div>
          <button className="button button--secondary" onClick={() => navigator.clipboard.writeText(credential.secret)}><Copy />คัดลอก</button>
        </div>
      )}

      <section className="device-section" aria-labelledby="stations-title">
        <div className="device-section__heading"><div><p className="registry-label">Gateway layer</p><h2 id="stations-title">Weather Station</h2></div></div>
        <DeviceList
          devices={activeStations}
          plots={plots}
          workingId={workingId}
          onCredential={issueCredential}
          onDecommission={decommission}
          onEdit={(dev) => { setEditingDevice(dev); setCalibrationSensor(null); setHistorySensor(null); }}
          emptyTitle="ยังไม่มีสถานีที่ใช้งาน"
        />
      </section>

      <section className="device-section" aria-labelledby="sensors-title">
        <div className="device-section__heading">
          <div><p className="registry-label">Field layer</p><h2 id="sensors-title">Soil Sensor</h2></div>
          {activeStations.length > 0 && activeSensors.length > 0 && plots.length > 0 && (
            <button className="button button--secondary" onClick={() => setShowAssignment((value) => !value)}>กำหนดการติดตั้ง</button>
          )}
        </div>
        {showAssignment && (
          <form className="assignment-form" onSubmit={assignSensor}>
            <div className="form-field"><label htmlFor="assign-sensor">เซนเซอร์</label><select id="assign-sensor" name="sensor_id" required>{activeSensors.map((item) => <option key={item.id} value={item.id}>{item.display_name}</option>)}</select></div>
            <div className="form-field"><label htmlFor="assign-station">สถานี</label><select id="assign-station" name="station_id" required>{activeStations.map((item) => <option key={item.id} value={item.id}>{item.display_name}</option>)}</select></div>
            <div className="form-field"><label htmlFor="assign-plot">แปลง</label><select id="assign-plot" name="plot_id" required>{plots.map((plot) => <option key={plot.id} value={plot.id}>{plot.name}</option>)}</select></div>
            <div className="form-field"><label htmlFor="depth">ความลึก (ซม.)</label><input id="depth" name="installation_depth_cm" type="number" min="0" max="500" step="0.1" /></div>
            <div className="form-field assignment-form__note"><label htmlFor="assign-note">หมายเหตุ</label><input id="assign-note" name="note" /></div>
            <button className="button button--primary" type="submit">บันทึก assignment</button>
          </form>
        )}
        <DeviceList
          devices={activeSensors}
          plots={plots}
          workingId={workingId}
          onCredential={issueCredential}
          onDecommission={decommission}
          onEdit={(dev) => { setEditingDevice(dev); setCalibrationSensor(null); setHistorySensor(null); }}
          onCalibrate={openCalibration}
          onHistory={openHistory}
          emptyTitle="ยังไม่มีเซนเซอร์ที่ใช้งาน"
        />
      </section>

      <section className="device-section device-section--history" id="decommissioned-devices" aria-labelledby="decommissioned-title" hidden={!showDecommissioned}>
        <div className="device-section__heading"><div><p className="registry-label">Lifecycle history</p><h2 id="decommissioned-title">ประวัติอุปกรณ์ที่ยกเลิก</h2><p>เก็บไว้สำหรับตรวจสอบย้อนหลัง โดย credential และ assignment ปัจจุบันถูกปิดแล้ว</p></div></div>
        <DeviceList devices={decommissionedDevices} plots={plots} workingId={workingId} onCredential={issueCredential} onDecommission={decommission} />
      </section>
    </>
  );
}

function DeviceForm({ kind, plots, onSubmit, onCancel }: { kind: "station" | "sensor"; plots: Plot[]; onSubmit: (event: FormEvent<HTMLFormElement>, kind: "station" | "sensor") => void; onCancel: () => void }) {
  return <form className="registry-form" onSubmit={(event) => onSubmit(event, kind)}>
    <div className="registry-form__heading"><div><p className="eyebrow">{kind === "station" ? "Weather station" : "Soil sensor"}</p><h2>ลงทะเบียน{kind === "station" ? "สถานีตรวจอากาศ" : "เซนเซอร์ดิน"}</h2></div><button className="text-action" type="button" onClick={onCancel}>ยกเลิก</button></div>
    <div className="registry-form__grid">
      <div className="form-field"><label htmlFor="device-code">รหัสอุปกรณ์</label><input id="device-code" name="device_code" pattern="[A-Za-z0-9._-]+" required placeholder={kind === "station" ? "WS-001" : "SOIL-001"} /></div>
      <div className="form-field"><label htmlFor="display-name">ชื่อที่แสดง</label><input id="display-name" name="display_name" required /></div>
      <div className="form-field"><label htmlFor="device-plot">แปลง</label><select id="device-plot" name="plot_id"><option value="">ยังไม่กำหนด</option>{plots.map((plot) => <option key={plot.id} value={plot.id}>{plot.name}</option>)}</select></div>
      <div className="form-field"><label htmlFor="firmware">Firmware</label><input id="firmware" name="firmware_version" placeholder="เช่น 2.0.0" /></div>
      {kind === "station" ? <><div className="form-field"><label htmlFor="model">รุ่น</label><input id="model" name="model" /></div><div className="form-field"><label htmlFor="serial">Serial number</label><input id="serial" name="serial_number" /></div></> : <><div className="form-field"><label htmlFor="sensor-type">ชนิดเซนเซอร์</label><select id="sensor-type" name="sensor_type"><option value="SOIL_TH">SOIL_TH</option><option value="SOIL_7_IN_1">SOIL_7_IN_1</option></select></div><div className="form-field"><label htmlFor="modbus">Modbus address</label><input id="modbus" name="modbus_address" type="number" min="1" max="247" /></div></>}
    </div>
    <button className="button button--primary" type="submit">ลงทะเบียนอุปกรณ์</button>
  </form>;
}

function DeviceList({
  devices,
  plots,
  workingId,
  onCredential,
  onDecommission,
  onEdit,
  onCalibrate,
  onHistory,
  emptyTitle = "ยังไม่มีอุปกรณ์ประเภทนี้",
}: {
  devices: Device[];
  plots: Plot[];
  workingId: string | null;
  onCredential: (device: Device) => void;
  onDecommission: (device: Device) => void;
  onEdit?: (device: Device) => void;
  onCalibrate?: (device: Device) => void;
  onHistory?: (device: Device) => void;
  emptyTitle?: string;
}) {
  if (devices.length === 0) return <div className="registry-empty"><Cpu /><h3>{emptyTitle}</h3><p>รายการที่ลงทะเบียนจะปรากฏพร้อมรหัสและสถานะการใช้งาน</p></div>;
  return (
    <div className="device-table" role="list">
      {devices.map((device) => {
        const Icon = device.kind === "WEATHER_STATION" ? CloudSun : Cpu;
        const plotName = plots.find((plot) => plot.id === device.plot_id)?.name;
        return (
          <article className="device-row" key={device.id} role="listitem">
            <Icon aria-hidden="true" />
            <div className="device-row__identity">
              <strong>{device.display_name}</strong>
              <code>{device.device_code}</code>
            </div>
            <div>
              <span className="device-row__label">ตำแหน่ง</span>
              <strong>{plotName || "ยังไม่กำหนดแปลง"}</strong>
            </div>
            <div>
              <span className="device-row__label">รายละเอียด</span>
              <strong>{device.kind === "SOIL_SENSOR" ? `${device.sensor_type}${device.modbus_address ? ` · Addr ${device.modbus_address}` : ""}` : device.model || "ไม่ระบุรุ่น"}</strong>
            </div>
            <span className={`registry-status${device.status === "ACTIVE" ? " registry-status--active" : " registry-status--off"}`}>{device.status === "ACTIVE" ? "ใช้งาน" : "ยกเลิกแล้ว"}</span>
            <div className="device-row__actions" style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
              {device.status === "ACTIVE" && onEdit && (
                <button className="button button--secondary" style={{ minHeight: 38, padding: "4px 8px" }} onClick={() => onEdit(device)} title="แก้ไข">
                  <Pencil style={{ width: 14 }} />
                </button>
              )}
              {device.kind === "SOIL_SENSOR" && device.status === "ACTIVE" && onCalibrate && (
                <button className="button button--secondary" style={{ minHeight: 38, padding: "4px 8px" }} onClick={() => onCalibrate(device)} title="สอบเทียบ">
                  <Sliders style={{ width: 14 }} />
                </button>
              )}
              {device.kind === "SOIL_SENSOR" && onHistory && (
                <button className="button button--secondary" style={{ minHeight: 38, padding: "4px 8px" }} onClick={() => onHistory(device)} title="ประวัติการติดตั้ง">
                  <History style={{ width: 14 }} />
                </button>
              )}
              {device.kind === "WEATHER_STATION" && device.status === "ACTIVE" && (
                <button className="button button--secondary" disabled={workingId === device.id} onClick={() => onCredential(device)}>
                  <KeyRound />Credential
                </button>
              )}
              {device.status === "ACTIVE" && (
                <button className="button button--danger" disabled={workingId === device.id} onClick={() => onDecommission(device)}>
                  <Unplug />ยกเลิก
                </button>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function RegistryState({ icon: Icon, title, action, danger = false, spinning = false }: { icon: typeof Cpu; title: string; action?: React.ReactNode; danger?: boolean; spinning?: boolean }) {
  return <div className={`workspace-state${danger ? " workspace-state--danger" : ""}`}><Icon className={spinning ? "is-spinning" : undefined} /><h2>{title}</h2>{action}</div>;
}
