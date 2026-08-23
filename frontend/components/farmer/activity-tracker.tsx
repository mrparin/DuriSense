"use client";

import {
  CheckCircle,
  ClipboardList,
  Droplet,
  Flame,
  Leaf,
  LoaderCircle,
  Plus,
  Scissors,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type Farm = { id: string; name: string };
type Plot = { id: string; name: string };

type ActivityType = "IRRIGATION" | "FERTILIZATION" | "PESTICIDE" | "PRUNING" | "HARVEST" | "OTHER";

type FarmActivity = {
  id: string;
  farm_id: string;
  plot_id: string | null;
  plot_name: string | null;
  recorded_by_id: string;
  recorded_by_name: string;
  activity_type: ActivityType;
  title: string;
  description: string | null;
  performed_at: string;
  volume_liters: number | null;
  product_name: string | null;
  amount_kg: number | null;
  harvest_weight_kg: number | null;
  created_at: string;
};

const ACTIVITY_META: Record<ActivityType, { label: string; icon: typeof Droplet; color: string; badgeBg: string }> = {
  IRRIGATION: { label: "การให้น้ำ", icon: Droplet, color: "#2563eb", badgeBg: "#dbeafe" },
  FERTILIZATION: { label: "การใส่ปุ๋ย/แร่ธาตุ", icon: Leaf, color: "#059669", badgeBg: "#d1fae5" },
  PESTICIDE: { label: "ฉีดพ่นสารเคมี/ชีวภัณฑ์", icon: Flame, color: "#d97706", badgeBg: "#fef3c7" },
  PRUNING: { label: "ตัดแต่งกิ่ง/ดอก/ผล", icon: Scissors, color: "#7c3aed", badgeBg: "#ede9fe" },
  HARVEST: { label: "เก็บเกี่ยวผลผลิตทุเรียน", icon: ShoppingBag, color: "#ea580c", badgeBg: "#ffedd5" },
  OTHER: { label: "กิจกรรมอื่นๆ", icon: ClipboardList, color: "#4b5563", badgeBg: "#f3f4f6" },
};

function getDefaultTitle(type: ActivityType): string {
  if (type === "IRRIGATION") return "ให้น้ำแปลงสปริงเกลอร์ 30 นาที";
  if (type === "FERTILIZATION") return "ใส่ปุ๋ยบำรุงรอบใบ/ดอก";
  if (type === "PESTICIDE") return "ฉีดพ่นสารชีวภัณฑ์ป้องกันเชื้อรา";
  if (type === "PRUNING") return "ตัดแต่งกิ่งแขนงและแต่งดอกทุเรียน";
  if (type === "HARVEST") return "เก็บเกี่ยวผลผลิตทุเรียนหมอนทอง";
  return "บันทึกการดูแลสวนประจำวัน";
}

export function ActivityTracker() {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [farmId, setFarmId] = useState("");
  const [plots, setPlots] = useState<Plot[]>([]);
  const [activities, setActivities] = useState<FarmActivity[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter & Form States
  const [selectedPlotFilter, setSelectedPlotFilter] = useState("all");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("all");
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Form Fields
  const [plotId, setPlotId] = useState("");
  const [activityType, setActivityType] = useState<ActivityType>("IRRIGATION");
  const [title, setTitle] = useState(() => getDefaultTitle("IRRIGATION"));
  const [description, setDescription] = useState("");
  const [performedDate, setPerformedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [performedTime, setPerformedTime] = useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  });
  const [volumeLiters, setVolumeLiters] = useState("");
  const [productName, setProductName] = useState("");
  const [amountKg, setAmountKg] = useState("");
  const [harvestWeightKg, setHarvestWeightKg] = useState("");

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
          setError("ไม่สามารถโหลดข้อมูลสวนได้ กรุณาตรวจสอบการเข้าสู่ระบบ");
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  // Load plots
  useEffect(() => {
    if (!farmId) return;
    apiFetch<Plot[]>(`/farms/${farmId}/plots`)
      .then(setPlots)
      .catch(() => setPlots([]));
  }, [farmId]);

  // Load activities callback
  const loadActivities = useCallback(async () => {
    if (!farmId) return;
    setLoading(true);
    try {
      const data = await apiFetch<FarmActivity[]>(`/farms/${farmId}/activities`);
      setActivities(data);
    } catch {
      setError("ไม่สามารถโหลดประวัติกิจกรรมได้");
    } finally {
      setLoading(false);
    }
  }, [farmId]);

  useEffect(() => {
    let active = true;
    if (!farmId) return;
    apiFetch<FarmActivity[]>(`/farms/${farmId}/activities`)
      .then((data) => {
        if (active) {
          setActivities(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [farmId]);

  const handleActivityTypeChange = (type: ActivityType) => {
    setActivityType(type);
    setTitle(getDefaultTitle(type));
  };

  // Submit New Activity
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    setError("");

    try {
      const payload = {
        plot_id: plotId || null,
        activity_type: activityType,
        title: title.trim(),
        description: description.trim() || null,
        performed_at: new Date(`${performedDate}T${performedTime}:00`).toISOString(),
        volume_liters: volumeLiters ? parseFloat(volumeLiters) : null,
        product_name: productName.trim() || null,
        amount_kg: amountKg ? parseFloat(amountKg) : null,
        harvest_weight_kg: harvestWeightKg ? parseFloat(harvestWeightKg) : null,
      };

      await apiFetch<FarmActivity>(`/farms/${farmId}/activities`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setSuccessMsg("บันทึกกิจกรรมเรียบร้อยแล้ว");
      setShowModal(false);
      // Reset form
      setDescription("");
      setVolumeLiters("");
      setProductName("");
      setAmountKg("");
      setHarvestWeightKg("");
      await loadActivities();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการบันทึกกิจกรรม";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Activity
  const handleDelete = async (id: string) => {
    if (!confirm("คุณต้องการลบบันทึกกิจกรรมนี้ใช่หรือไม่?")) return;
    try {
      await apiFetch(`/farms/${farmId}/activities/${id}`, { method: "DELETE" });
      setSuccessMsg("ลบบันทึกกิจกรรมเรียบร้อยแล้ว");
      await loadActivities();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการลบบันทึก";
      setError(msg);
    }
  };

  // Filtered Activities
  const filteredActivities = activities.filter((act) => {
    const matchPlot = selectedPlotFilter === "all" || act.plot_id === selectedPlotFilter;
    const matchType = selectedTypeFilter === "all" || act.activity_type === selectedTypeFilter;
    return matchPlot && matchType;
  });

  return (
    <>
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">Farm Operations & Cultivation Journal</p>
          <h1>บันทึกกิจกรรมการดูแลสวนทุเรียน</h1>
          <p>บันทึกและติดตามประวัติการให้น้ำ ใส่ปุ๋ย ฉีดพ่นสาร ตัดแต่งกิ่ง และผลผลิตเก็บเกี่ยว</p>
        </div>
        <div className="workspace-heading__actions">
          <button className="button button--primary" onClick={() => setShowModal(true)}>
            <Plus style={{ width: 16 }} /> บันทึกกิจกรรมใหม่
          </button>
        </div>
      </div>

      {/* Toolbar Filters */}
      <div className="registry-toolbar" style={{ flexWrap: "wrap", gap: "var(--space-3)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <label htmlFor="farm-select"><strong>สวน:</strong></label>
          <select
            id="farm-select"
            value={farmId}
            onChange={(e) => { setFarmId(e.target.value); setSelectedPlotFilter("all"); }}
            style={{ fontWeight: 600 }}
          >
            {farms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <label htmlFor="plot-filter"><strong>แปลง:</strong></label>
          <select
            id="plot-filter"
            value={selectedPlotFilter}
            onChange={(e) => setSelectedPlotFilter(e.target.value)}
          >
            <option value="all">ทุกแปลง ({plots.length} แปลง)</option>
            {plots.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <label htmlFor="type-filter"><strong>ประเภท:</strong></label>
          <select
            id="type-filter"
            value={selectedTypeFilter}
            onChange={(e) => setSelectedTypeFilter(e.target.value)}
          >
            <option value="all">ทุกประเภทกิจกรรม</option>
            {Object.entries(ACTIVITY_META).map(([k, meta]) => (
              <option key={k} value={k}>{meta.label}</option>
            ))}
          </select>
        </div>
      </div>

      {error && <div className="form-status form-status--danger" style={{ marginTop: "var(--space-3)", display: "block", width: "100%", whiteSpace: "normal" }}>{error}</div>}
      {successMsg && <div className="form-status form-status--success" style={{ marginTop: "var(--space-3)", display: "block", width: "100%", whiteSpace: "normal" }}>{successMsg}</div>}

      {/* Activities Timeline List */}
      {loading ? (
        <div className="workspace-state"><LoaderCircle className="is-spinning" /><h2>กำลังโหลดประวัติกิจกรรม...</h2></div>
      ) : filteredActivities.length === 0 ? (
        <div className="registry-empty" style={{ marginTop: "var(--space-5)" }}>
          <ClipboardList style={{ opacity: 0.4 }} />
          <h3>ยังไม่มีบันทึกกิจกรรมการดูแลสวน</h3>
          <p>กดปุ่ม &quot;บันทึกกิจกรรมใหม่&quot; เพื่อเริ่มบันทึกการให้น้ำ ใส่ปุ๋ย หรือเก็บเกี่ยวผลผลิต</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "var(--space-4)", marginTop: "var(--space-4)" }}>
          {filteredActivities.map((act) => {
            const meta = ACTIVITY_META[act.activity_type] || ACTIVITY_META.OTHER;
            const Icon = meta.icon;

            return (
              <div
                key={act.id}
                style={{
                  background: "#fff",
                  border: "1px solid var(--line-strong)",
                  borderRadius: "var(--radius-sm)",
                  padding: "var(--space-4) var(--space-5)",
                  display: "grid",
                  gridTemplateColumns: "auto 1fr auto",
                  gap: "var(--space-4)",
                  alignItems: "center",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
                }}
              >
                {/* Type Icon Badge */}
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    background: meta.badgeBg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon style={{ width: 22, height: 22, color: meta.color }} />
                </div>

                {/* Content */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap", marginBottom: "4px" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: meta.color, background: meta.badgeBg, padding: "2px 8px", borderRadius: 4 }}>
                      {meta.label}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-700)" }}>
                      แปลง: {act.plot_name || "ส่วนกลางสวน"}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--ink-500)", marginLeft: "auto" }}>
                      📅 {new Date(act.performed_at).toLocaleString("th-TH", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>

                  <h3 style={{ fontSize: 16, margin: "2px 0 4px", color: "var(--ink-950)" }}>
                    {act.title}
                  </h3>

                  {act.description && (
                    <p style={{ fontSize: 13, color: "var(--ink-700)", margin: "0 0 6px" }}>
                      {act.description}
                    </p>
                  )}

                  {/* Specific Metrics Tags */}
                  <div style={{ display: "flex", gap: "var(--space-3)", fontSize: 12, color: "var(--ink-800)", flexWrap: "wrap" }}>
                    {act.volume_liters != null && (
                      <span style={{ background: "#eff6ff", padding: "2px 8px", borderRadius: 4 }}>
                        💧 ปริมาณน้ำ: <strong>{act.volume_liters.toLocaleString()} ลิตร</strong>
                      </span>
                    )}
                    {act.product_name && (
                      <span style={{ background: "#ecfdf5", padding: "2px 8px", borderRadius: 4 }}>
                        🌿 ชนิดปุ๋ย/สารเคมี: <strong>{act.product_name}</strong> {act.amount_kg != null ? `(${act.amount_kg} กก.)` : ""}
                      </span>
                    )}
                    {act.harvest_weight_kg != null && (
                      <span style={{ background: "#fff7ed", padding: "2px 8px", borderRadius: 4 }}>
                        🍈 ผลผลิตทุเรียน: <strong>{act.harvest_weight_kg.toLocaleString()} กก.</strong>
                      </span>
                    )}
                    <span style={{ color: "var(--ink-500)" }}>
                      บันทึกโดย: {act.recorded_by_name}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div>
                  <button
                    type="button"
                    onClick={() => handleDelete(act.id)}
                    style={{
                      background: "none",
                      border: 0,
                      color: "#9ca3af",
                      cursor: "pointer",
                      padding: "6px",
                      borderRadius: 4,
                    }}
                    title="ลบบันทึกนี้"
                  >
                    <Trash2 style={{ width: 18 }} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Dialog Form */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "var(--space-4)" }}>
          <div style={{ background: "#fff", borderRadius: "var(--radius-md)", width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto", padding: "var(--space-6)", boxShadow: "0 10px 30px rgba(0,0,0,0.3)", position: "relative" }}>
            <h2 style={{ fontSize: 18, marginTop: 0, marginBottom: "var(--space-4)", display: "flex", alignItems: "center", gap: "8px" }}>
              ➕ บันทึกกิจกรรมการดูแลสวน
            </h2>

            <form onSubmit={handleSubmit} style={{ display: "grid", gap: "var(--space-4)" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                <div>
                  <label htmlFor="activity-type">ประเภทกิจกรรม *</label>
                  <select
                    id="activity-type"
                    value={activityType}
                    onChange={(e) => handleActivityTypeChange(e.target.value as ActivityType)}
                    style={{ width: "100%", padding: "8px" }}
                  >
                    {Object.entries(ACTIVITY_META).map(([k, meta]) => (
                      <option key={k} value={k}>{meta.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="plot-select-form">แปลง/โซน *</label>
                  <select
                    id="plot-select-form"
                    value={plotId}
                    onChange={(e) => setPlotId(e.target.value)}
                    style={{ width: "100%", padding: "8px" }}
                  >
                    <option value="">-- สวนส่วนกลาง / ทุกแปลง --</option>
                    {plots.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="title-form">หัวข้อกิจกรรม *</label>
                <input
                  id="title-form"
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="เช่น ให้น้ำสปริงเกลอร์ 30 นาที, ใส่ปุ๋ย 8-24-24"
                  style={{ width: "100%", padding: "8px" }}
                />
              </div>

              {/* Separate Date and Time Inputs for Clean, Non-overlapping Picking */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                <div>
                  <label htmlFor="performed-date">วันที่ทำกิจกรรม *</label>
                  <input
                    id="performed-date"
                    type="date"
                    required
                    value={performedDate}
                    onChange={(e) => setPerformedDate(e.target.value)}
                    style={{ width: "100%", padding: "8px" }}
                  />
                </div>

                <div>
                  <label htmlFor="performed-time">เวลาที่ทำกิจกรรม *</label>
                  <input
                    id="performed-time"
                    type="time"
                    required
                    value={performedTime}
                    onChange={(e) => setPerformedTime(e.target.value)}
                    style={{ width: "100%", padding: "8px" }}
                  />
                </div>
              </div>

              {/* Conditional Operational Inputs */}
              {activityType === "IRRIGATION" && (
                <div>
                  <label htmlFor="volume-liters">ปริมาณน้ำโดยประมาณ (ลิตร)</label>
                  <input
                    id="volume-liters"
                    type="number"
                    step="any"
                    value={volumeLiters}
                    onChange={(e) => setVolumeLiters(e.target.value)}
                    placeholder="เช่น 1500"
                    style={{ width: "100%", padding: "8px" }}
                  />
                </div>
              )}

              {(activityType === "FERTILIZATION" || activityType === "PESTICIDE") && (
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "var(--space-3)" }}>
                  <div>
                    <label htmlFor="product-name">ชื่อปุ๋ย / สารเคมี / ชีวภัณฑ์</label>
                    <input
                      id="product-name"
                      type="text"
                      value={productName}
                      onChange={(e) => setProductName(e.target.value)}
                      placeholder="เช่น ปุ๋ยสูตร 8-24-24, ไตรโคเดอร์มา"
                      style={{ width: "100%", padding: "8px" }}
                    />
                  </div>
                  <div>
                    <label htmlFor="amount-kg">ปริมาณ (กก. / ลิตร)</label>
                    <input
                      id="amount-kg"
                      type="number"
                      step="any"
                      value={amountKg}
                      onChange={(e) => setAmountKg(e.target.value)}
                      placeholder="เช่น 25"
                      style={{ width: "100%", padding: "8px" }}
                    />
                  </div>
                </div>
              )}

              {activityType === "HARVEST" && (
                <div>
                  <label htmlFor="harvest-weight">น้ำหนักผลผลิตทุเรียนที่เก็บเกี่ยวได้ (กก.)</label>
                  <input
                    id="harvest-weight"
                    type="number"
                    step="any"
                    value={harvestWeightKg}
                    onChange={(e) => setHarvestWeightKg(e.target.value)}
                    placeholder="เช่น 450"
                    style={{ width: "100%", padding: "8px" }}
                  />
                </div>
              )}

              <div>
                <label htmlFor="description-form">รายละเอียดเพิ่มเติม / หมายเหตุ</label>
                <textarea
                  id="description-form"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="บันทึกสภาพอากาศ หรือข้อสังเกตเพิ่มเติม..."
                  style={{ width: "100%", padding: "8px" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-2)", marginTop: "var(--space-4)", paddingTop: "var(--space-3)", borderTop: "1px solid var(--line)" }}>
                <button type="button" className="button button--ghost" onClick={() => setShowModal(false)}>
                  ยกเลิก
                </button>
                <button type="submit" className="button button--primary" disabled={submitting}>
                  {submitting ? <LoaderCircle className="is-spinning" /> : <CheckCircle style={{ width: 16 }} />}
                  บันทึกกิจกรรม
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
