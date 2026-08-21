"use client";

import { AlertCircle, CheckCircle2, CloudSun, Copy, Cpu, History, KeyRound, LoaderCircle, Plus, RefreshCw, Unplug } from "lucide-react";
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
        <div><p className="eyebrow">Device registry</p><h1>ทะเบียนอุปกรณ์</h1><p>ลงทะเบียน Weather Station และ Soil Sensor ด้วยรหัสที่ตรวจสอบย้อนกลับได้ พร้อมประวัติการติดตั้งและยกเลิกใช้งาน</p></div>
        <div className="workspace-heading__actions"><button className="button button--secondary" onClick={() => setShowForm("sensor")}><Plus />เพิ่มเซนเซอร์</button><button className="button button--primary" onClick={() => setShowForm("station")}><Plus />เพิ่มสถานี</button></div>
      </div>

      <div className="registry-toolbar">
        <label htmlFor="device-farm">บริบทสวน</label>
        <select id="device-farm" value={farmId} onChange={(event) => { setFarmId(event.target.value); setShowDecommissioned(false); setCredential(null); }}>{farms.map((farm) => <option value={farm.id} key={farm.id}>{farm.name}</option>)}</select>
        <span>{activeStations.length} สถานี · {activeSensors.length} เซนเซอร์ที่ใช้งาน</span>
        {decommissionedDevices.length > 0 && <button className="button button--secondary registry-history-toggle" type="button" aria-expanded={showDecommissioned} aria-controls="decommissioned-devices" onClick={() => setShowDecommissioned((value) => !value)}><History aria-hidden="true" />{showDecommissioned ? "ซ่อนประวัติ" : `แสดงประวัติ (${decommissionedDevices.length})`}</button>}
      </div>
      {notice && <div className="form-status form-status--success" role="status"><CheckCircle2 /><div><strong>{notice}</strong></div></div>}
      {error && <div className="form-status form-status--danger" role="alert"><AlertCircle /><div><strong>{error}</strong></div></div>}

      {showForm && <DeviceForm kind={showForm} plots={plots} onSubmit={createDevice} onCancel={() => setShowForm(null)} />}

      {credential && <div className="credential-result" role="status"><KeyRound /><div><strong>คัดลอก credential ตอนนี้</strong><p>ระบบจัดเก็บเฉพาะ hash และจะไม่แสดง secret นี้ซ้ำ</p><code>{credential.secret}</code></div><button className="button button--secondary" onClick={() => navigator.clipboard.writeText(credential.secret)}><Copy />คัดลอก</button></div>}

      <section className="device-section" aria-labelledby="stations-title">
        <div className="device-section__heading"><div><p className="registry-label">Gateway layer</p><h2 id="stations-title">Weather Station</h2></div></div>
        <DeviceList devices={activeStations} plots={plots} workingId={workingId} onCredential={issueCredential} onDecommission={decommission} emptyTitle="ยังไม่มีสถานีที่ใช้งาน" />
      </section>

      <section className="device-section" aria-labelledby="sensors-title">
        <div className="device-section__heading"><div><p className="registry-label">Field layer</p><h2 id="sensors-title">Soil Sensor</h2></div>{activeStations.length > 0 && activeSensors.length > 0 && plots.length > 0 && <button className="button button--secondary" onClick={() => setShowAssignment((value) => !value)}>กำหนดการติดตั้ง</button>}</div>
        {showAssignment && <form className="assignment-form" onSubmit={assignSensor}>
          <div className="form-field"><label htmlFor="assign-sensor">เซนเซอร์</label><select id="assign-sensor" name="sensor_id" required>{activeSensors.map((item) => <option key={item.id} value={item.id}>{item.display_name}</option>)}</select></div>
          <div className="form-field"><label htmlFor="assign-station">สถานี</label><select id="assign-station" name="station_id" required>{activeStations.map((item) => <option key={item.id} value={item.id}>{item.display_name}</option>)}</select></div>
          <div className="form-field"><label htmlFor="assign-plot">แปลง</label><select id="assign-plot" name="plot_id" required>{plots.map((plot) => <option key={plot.id} value={plot.id}>{plot.name}</option>)}</select></div>
          <div className="form-field"><label htmlFor="depth">ความลึก (ซม.)</label><input id="depth" name="installation_depth_cm" type="number" min="0" max="500" step="0.1" /></div>
          <div className="form-field assignment-form__note"><label htmlFor="assign-note">หมายเหตุ</label><input id="assign-note" name="note" /></div>
          <button className="button button--primary" type="submit">บันทึก assignment</button>
        </form>}
        <DeviceList devices={activeSensors} plots={plots} workingId={workingId} onCredential={issueCredential} onDecommission={decommission} emptyTitle="ยังไม่มีเซนเซอร์ที่ใช้งาน" />
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

function DeviceList({ devices, plots, workingId, onCredential, onDecommission, emptyTitle = "ยังไม่มีอุปกรณ์ประเภทนี้" }: { devices: Device[]; plots: Plot[]; workingId: string | null; onCredential: (device: Device) => void; onDecommission: (device: Device) => void; emptyTitle?: string }) {
  if (devices.length === 0) return <div className="registry-empty"><Cpu /><h3>{emptyTitle}</h3><p>รายการที่ลงทะเบียนจะปรากฏพร้อมรหัสและสถานะการใช้งาน</p></div>;
  return <div className="device-table" role="list">{devices.map((device) => {
    const Icon = device.kind === "WEATHER_STATION" ? CloudSun : Cpu;
    const plotName = plots.find((plot) => plot.id === device.plot_id)?.name;
    return <article className="device-row" key={device.id} role="listitem"><Icon aria-hidden="true" /><div className="device-row__identity"><strong>{device.display_name}</strong><code>{device.device_code}</code></div><div><span className="device-row__label">ตำแหน่ง</span><strong>{plotName || "ยังไม่กำหนดแปลง"}</strong></div><div><span className="device-row__label">รายละเอียด</span><strong>{device.kind === "SOIL_SENSOR" ? `${device.sensor_type}${device.modbus_address ? ` · Address ${device.modbus_address}` : ""}` : device.model || "ไม่ระบุรุ่น"}</strong></div><span className={`registry-status${device.status === "ACTIVE" ? " registry-status--active" : " registry-status--off"}`}>{device.status === "ACTIVE" ? "ใช้งาน" : "ยกเลิกแล้ว"}</span><div className="device-row__actions">{device.kind === "WEATHER_STATION" && device.status === "ACTIVE" && <button className="button button--secondary" disabled={workingId === device.id} onClick={() => onCredential(device)}><KeyRound />Credential</button>}{device.status === "ACTIVE" && <button className="button button--danger" disabled={workingId === device.id} onClick={() => onDecommission(device)}><Unplug />ยกเลิก</button>}</div></article>;
  })}</div>;
}

function RegistryState({ icon: Icon, title, action, danger = false, spinning = false }: { icon: typeof Cpu; title: string; action?: React.ReactNode; danger?: boolean; spinning?: boolean }) {
  return <div className={`workspace-state${danger ? " workspace-state--danger" : ""}`}><Icon className={spinning ? "is-spinning" : undefined} /><h2>{title}</h2>{action}</div>;
}
