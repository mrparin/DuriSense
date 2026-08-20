"use client";

import { AlertCircle, CheckCircle2, ChevronRight, LandPlot, LoaderCircle, MapPinned, Plus, RefreshCw, Sprout } from "lucide-react";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";

type Farm = {
  id: string;
  tenant_id: string;
  name: string;
  timezone: string;
  province?: string | null;
  district?: string | null;
  subdistrict?: string | null;
  status: "ACTIVE" | "ARCHIVED";
  membership_role: "OWNER" | "MANAGER" | "MEMBER" | "TECHNICIAN";
};

type Plot = {
  id: string;
  name: string;
  area_rai?: number | null;
  crop_variety?: string | null;
  notes?: string | null;
  active: boolean;
};

type ViewState = "loading" | "ready" | "unauthorized" | "error";
type SessionContext = { tenants: Array<{ id: string; name: string }> };

export function FarmWorkspace() {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [tenantId, setTenantId] = useState("");
  const [selectedFarmId, setSelectedFarmId] = useState("");
  const [plots, setPlots] = useState<Plot[]>([]);
  const [state, setState] = useState<ViewState>("loading");
  const [plotsLoading, setPlotsLoading] = useState(false);
  const [showFarmForm, setShowFarmForm] = useState(false);
  const [showPlotForm, setShowPlotForm] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const loadFarms = useCallback(async () => {
    setState("loading");
    try {
      const [items, session] = await Promise.all([apiFetch<Farm[]>("/farms"), apiFetch<SessionContext>("/auth/session")]);
      setFarms(items);
      setTenantId(session.tenants[0]?.id ?? "");
      setSelectedFarmId((current) => current && items.some((farm) => farm.id === current) ? current : items[0]?.id ?? "");
      setState("ready");
    } catch (reason) {
      setState(reason instanceof ApiError && reason.status === 401 ? "unauthorized" : "error");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([apiFetch<Farm[]>("/farms"), apiFetch<SessionContext>("/auth/session")])
      .then(([items, session]) => {
        if (cancelled) return;
        setFarms(items);
        setTenantId(session.tenants[0]?.id ?? "");
        setSelectedFarmId(items[0]?.id ?? "");
        setState("ready");
      })
      .catch((reason) => {
        if (!cancelled) setState(reason instanceof ApiError && reason.status === 401 ? "unauthorized" : "error");
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!selectedFarmId) return;
    let cancelled = false;
    apiFetch<Plot[]>(`/farms/${selectedFarmId}/plots`)
      .then((items) => { if (!cancelled) setPlots(items); })
      .catch(() => { if (!cancelled) setError("โหลดข้อมูลแปลงไม่สำเร็จ กรุณาลองอีกครั้ง"); })
      .finally(() => { if (!cancelled) setPlotsLoading(false); });
    return () => { cancelled = true; };
  }, [selectedFarmId]);

  async function createFarm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const firstTenant = tenantId || farms[0]?.tenant_id;
    if (!firstTenant) { setError("ไม่พบบริบทองค์กรสำหรับสร้างสวน"); return; }
    setError("");
    try {
      const farm = await apiFetch<Farm>("/farms", { method: "POST", body: JSON.stringify({
        tenant_id: firstTenant,
        name: form.get("name"),
        province: form.get("province") || null,
        district: form.get("district") || null,
        subdistrict: form.get("subdistrict") || null,
        timezone: "Asia/Bangkok",
      }) });
      setFarms((current) => [...current, farm]);
      setSelectedFarmId(farm.id);
      setShowFarmForm(false);
      setNotice(`เพิ่มสวน “${farm.name}” แล้ว`);
      formElement.reset();
    } catch (reason) { setError(reason instanceof ApiError ? reason.body.message : "เพิ่มสวนไม่สำเร็จ"); }
  }

  async function createPlot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setError("");
    try {
      const plot = await apiFetch<Plot>(`/farms/${selectedFarmId}/plots`, { method: "POST", body: JSON.stringify({
        name: form.get("name"),
        area_rai: form.get("area_rai") ? Number(form.get("area_rai")) : null,
        crop_variety: form.get("crop_variety") || null,
        notes: form.get("notes") || null,
      }) });
      setPlots((current) => [...current, plot]);
      setShowPlotForm(false);
      setNotice(`เพิ่มแปลง “${plot.name}” แล้ว`);
      formElement.reset();
    } catch (reason) { setError(reason instanceof ApiError ? reason.body.message : "เพิ่มแปลงไม่สำเร็จ"); }
  }

  if (state === "loading") return <WorkspaceState icon={LoaderCircle} title="กำลังโหลดโครงสร้างสวน" spinning />;
  if (state === "unauthorized") return <WorkspaceState icon={AlertCircle} title="กรุณาเข้าสู่ระบบ" detail="พื้นที่นี้แสดงเฉพาะสวนที่บัญชีของคุณมีสิทธิ์เข้าถึง" action={<Link className="button button--primary" href="/login">เข้าสู่ระบบ</Link>} danger />;
  if (state === "error") return <WorkspaceState icon={AlertCircle} title="โหลดข้อมูลสวนไม่สำเร็จ" action={<button className="button button--secondary" onClick={loadFarms}><RefreshCw />ลองอีกครั้ง</button>} danger />;

  const selectedFarm = farms.find((farm) => farm.id === selectedFarmId);

  return (
    <>
      <div className="workspace-heading">
        <div><p className="eyebrow">Farm registry</p><h1>สวนและแปลง</h1><p>จัดโครงสร้างพื้นที่ก่อนเชื่อมสถานีและเซนเซอร์ ทุกข้อมูลถูกจำกัดตามสิทธิ์ของสมาชิกสวน</p></div>
        <button className="button button--primary" type="button" onClick={() => setShowFarmForm((value) => !value)}><Plus />เพิ่มสวน</button>
      </div>

      {notice && <div className="form-status form-status--success" role="status"><CheckCircle2 /><div><strong>{notice}</strong></div></div>}
      {error && <div className="form-status form-status--danger" role="alert"><AlertCircle /><div><strong>{error}</strong></div></div>}

      {showFarmForm && (
        <form className="registry-form" onSubmit={createFarm}>
          <div className="registry-form__heading"><div><p className="eyebrow">New farm</p><h2>เพิ่มสวนในองค์กรเดิม</h2></div><button className="text-action" type="button" onClick={() => setShowFarmForm(false)}>ยกเลิก</button></div>
          <div className="registry-form__grid">
            <div className="form-field registry-form__wide"><label htmlFor="farm-name">ชื่อสวน</label><input id="farm-name" name="name" required minLength={2} /></div>
            <div className="form-field"><label htmlFor="province">จังหวัด</label><input id="province" name="province" /></div>
            <div className="form-field"><label htmlFor="district">อำเภอ</label><input id="district" name="district" /></div>
            <div className="form-field"><label htmlFor="subdistrict">ตำบล</label><input id="subdistrict" name="subdistrict" /></div>
          </div>
          <button className="button button--primary" type="submit">บันทึกสวน</button>
        </form>
      )}

      {farms.length === 0 ? (
        <WorkspaceState icon={LandPlot} title="ยังไม่มีสวนในบัญชีนี้" detail="เพิ่มสวนแรกเพื่อเริ่มสร้างแปลงและลงทะเบียนอุปกรณ์" />
      ) : (
        <div className="registry-layout">
          <aside className="farm-selector" aria-label="เลือกสวน">
            <p className="registry-label">สวนที่เข้าถึงได้</p>
            {farms.map((farm) => <button key={farm.id} type="button" className="farm-selector__item" aria-pressed={farm.id === selectedFarmId} onClick={() => { setPlotsLoading(true); setSelectedFarmId(farm.id); }}>
              <span><strong>{farm.name}</strong><small>{[farm.subdistrict, farm.district, farm.province].filter(Boolean).join(" · ") || "ยังไม่ระบุที่ตั้ง"}</small></span><ChevronRight />
            </button>)}
          </aside>

          <section className="registry-surface" aria-labelledby="selected-farm-title">
            <div className="registry-surface__header">
              <div><p className="registry-kicker"><MapPinned />{selectedFarm?.membership_role === "OWNER" ? "เจ้าของสวน" : "สมาชิกสวน"}</p><h2 id="selected-farm-title">{selectedFarm?.name}</h2><p>{selectedFarm?.timezone} · {selectedFarm?.status === "ACTIVE" ? "กำลังใช้งาน" : "เก็บถาวร"}</p></div>
              <button className="button button--secondary" type="button" onClick={() => setShowPlotForm((value) => !value)}><Plus />เพิ่มแปลง</button>
            </div>

            {showPlotForm && <form className="registry-form registry-form--nested" onSubmit={createPlot}>
              <div className="registry-form__grid">
                <div className="form-field"><label htmlFor="plot-name">ชื่อแปลง</label><input id="plot-name" name="name" required /></div>
                <div className="form-field"><label htmlFor="area-rai">พื้นที่ (ไร่)</label><input id="area-rai" name="area_rai" type="number" min="0" step="0.01" /></div>
                <div className="form-field"><label htmlFor="crop-variety">พันธุ์ทุเรียน</label><input id="crop-variety" name="crop_variety" placeholder="เช่น หมอนทอง" /></div>
                <div className="form-field registry-form__wide"><label htmlFor="plot-notes">หมายเหตุ</label><input id="plot-notes" name="notes" /></div>
              </div>
              <div className="registry-form__actions"><button className="button button--primary" type="submit">บันทึกแปลง</button><button className="button button--secondary" type="button" onClick={() => setShowPlotForm(false)}>ยกเลิก</button></div>
            </form>}

            {plotsLoading ? <div className="registry-empty"><LoaderCircle className="is-spinning" /><p>กำลังโหลดแปลง</p></div> : plots.length === 0 ? <div className="registry-empty"><Sprout /><h3>สวนนี้ยังไม่มีแปลง</h3><p>เพิ่มแปลงเพื่อกำหนดตำแหน่งติดตั้งอุปกรณ์</p></div> : <div className="plot-list" role="list">
              {plots.map((plot, index) => <article className="plot-row" key={plot.id} role="listitem"><span className="plot-row__index">{String(index + 1).padStart(2, "0")}</span><div><h3>{plot.name}</h3><p>{plot.crop_variety || "ยังไม่ระบุพันธุ์"}{plot.area_rai != null ? ` · ${plot.area_rai} ไร่` : ""}</p>{plot.notes && <small>{plot.notes}</small>}</div><span className="registry-status registry-status--active">ใช้งาน</span></article>)}
            </div>}
          </section>
        </div>
      )}
    </>
  );
}

function WorkspaceState({ icon: Icon, title, detail, action, danger = false, spinning = false }: { icon: typeof LandPlot; title: string; detail?: string; action?: React.ReactNode; danger?: boolean; spinning?: boolean }) {
  return <div className={`workspace-state${danger ? " workspace-state--danger" : ""}`}><Icon className={spinning ? "is-spinning" : undefined} aria-hidden="true" /><h2>{title}</h2>{detail && <p>{detail}</p>}{action}</div>;
}
