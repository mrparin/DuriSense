"use client";

import { AlertCircle, CheckCircle2, LoaderCircle, ShieldCheck, UserPlus, Users } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";

type FarmRole = "OWNER" | "MANAGER" | "MEMBER" | "TECHNICIAN";

type FarmMembership = {
  id: string;
  farm_id: string;
  user_id: string;
  email: string;
  full_name: string;
  role: FarmRole;
  active: boolean;
};

const roleLabels: Record<FarmRole, string> = {
  OWNER: "เจ้าของสวน",
  MANAGER: "ผู้จัดการ",
  MEMBER: "สมาชิก",
  TECHNICIAN: "ช่างภาคสนาม",
};

export function FarmMembershipPanel({ farmId, actorRole, currentUserId }: { farmId: string; actorRole: FarmRole; currentUserId: string }) {
  const [memberships, setMemberships] = useState<FarmMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [busyMembershipId, setBusyMembershipId] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const canManage = actorRole === "OWNER" || actorRole === "MANAGER";
  const assignableRoles = useMemo<FarmRole[]>(
    () => actorRole === "OWNER" ? ["MANAGER", "MEMBER", "TECHNICIAN"] : ["MEMBER", "TECHNICIAN"],
    [actorRole],
  );

  useEffect(() => {
    let cancelled = false;
    apiFetch<FarmMembership[]>(`/farms/${farmId}/memberships`)
      .then((items) => { if (!cancelled) setMemberships(items); })
      .catch((reason) => { if (!cancelled) setError(reason instanceof ApiError ? reason.body.message : "โหลดรายชื่อสมาชิกไม่สำเร็จ"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [farmId]);

  function canEdit(member: FarmMembership) {
    if (!canManage || member.user_id === currentUserId || member.role === "OWNER") return false;
    return actorRole === "OWNER" || member.role === "MEMBER" || member.role === "TECHNICIAN";
  }

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const data = new FormData(formElement);
    setSubmitting(true);
    setNotice("");
    setError("");
    try {
      const membership = await apiFetch<FarmMembership>(`/farms/${farmId}/memberships`, {
        method: "POST",
        body: JSON.stringify({ email: data.get("email"), role: data.get("role") }),
      });
      setMemberships((current) => [...current, membership].sort((a, b) => a.full_name.localeCompare(b.full_name, "th")));
      setNotice(`เพิ่ม ${membership.full_name} เป็น${roleLabels[membership.role]}แล้ว`);
      formElement.reset();
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.body.message : "เพิ่มสมาชิกไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  }

  async function changeRole(member: FarmMembership, role: FarmRole) {
    setBusyMembershipId(member.id);
    setNotice("");
    setError("");
    try {
      const updated = await apiFetch<FarmMembership>(`/farms/${farmId}/memberships/${member.id}`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      setMemberships((current) => current.map((item) => item.id === updated.id ? updated : item));
      setNotice(`ปรับสิทธิ์ของ ${updated.full_name} เป็น${roleLabels[updated.role]}แล้ว`);
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.body.message : "ปรับสิทธิ์สมาชิกไม่สำเร็จ");
    } finally {
      setBusyMembershipId("");
    }
  }

  async function revokeMember(member: FarmMembership) {
    if (!window.confirm(`ถอนสิทธิ์ ${member.full_name} ออกจากสวนนี้หรือไม่?`)) return;
    setBusyMembershipId(member.id);
    setNotice("");
    setError("");
    try {
      await apiFetch(`/farms/${farmId}/memberships/${member.id}`, { method: "DELETE" });
      setMemberships((current) => current.filter((item) => item.id !== member.id));
      setNotice(`ถอนสิทธิ์ ${member.full_name} แล้ว`);
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.body.message : "ถอนสิทธิ์สมาชิกไม่สำเร็จ");
    } finally {
      setBusyMembershipId("");
    }
  }

  return (
    <section className="membership-panel" aria-labelledby="farm-membership-title">
      <div className="membership-panel__heading">
        <div>
          <p className="registry-kicker"><Users aria-hidden="true" />การเข้าถึงสวน</p>
          <h3 id="farm-membership-title">สมาชิกสวน</h3>
          <p>{canManage ? "เพิ่มสมาชิกองค์กรและกำหนดขอบเขตงานภายในสวนนี้" : "ดูผู้ที่มีสิทธิ์เข้าถึงสวนร่วมกับคุณ"}</p>
        </div>
        <span className="membership-authority"><ShieldCheck aria-hidden="true" />สิทธิ์ของคุณ: {roleLabels[actorRole]}</span>
      </div>

      {notice && <div className="form-status form-status--success" role="status"><CheckCircle2 aria-hidden="true" /><strong>{notice}</strong></div>}
      {error && <div className="form-status form-status--danger" role="alert"><AlertCircle aria-hidden="true" /><strong>{error}</strong></div>}

      {canManage && (
        <form className="membership-invite" onSubmit={addMember}>
          <div className="form-field">
            <label htmlFor={`member-email-${farmId}`}>อีเมลสมาชิกในองค์กร</label>
            <input id={`member-email-${farmId}`} name="email" type="email" autoComplete="email" required placeholder="farmer@example.com" />
          </div>
          <div className="form-field">
            <label htmlFor={`member-role-${farmId}`}>บทบาทในสวน</label>
            <select id={`member-role-${farmId}`} name="role" defaultValue={assignableRoles[0]}>
              {assignableRoles.map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}
            </select>
          </div>
          <button className="button button--primary" type="submit" disabled={submitting}>
            {submitting ? <LoaderCircle className="is-spinning" aria-hidden="true" /> : <UserPlus aria-hidden="true" />}
            {submitting ? "กำลังเพิ่ม" : "เพิ่มสมาชิก"}
          </button>
        </form>
      )}

      {loading ? (
        <div className="membership-state"><LoaderCircle className="is-spinning" aria-hidden="true" />กำลังโหลดสมาชิก</div>
      ) : memberships.length === 0 ? (
        <div className="membership-state"><Users aria-hidden="true" />ยังไม่มีสมาชิกในสวนนี้</div>
      ) : (
        <div className="membership-list" role="list">
          {memberships.map((member) => {
            const editable = canEdit(member);
            const busy = busyMembershipId === member.id;
            const roleOptions = actorRole === "OWNER" ? ["MANAGER", "MEMBER", "TECHNICIAN"] as FarmRole[] : ["MEMBER", "TECHNICIAN"] as FarmRole[];
            return (
              <article className="membership-row" role="listitem" key={member.id}>
                <span className="membership-avatar" aria-hidden="true">{member.full_name.trim().charAt(0).toUpperCase()}</span>
                <div className="membership-row__identity"><strong>{member.full_name}</strong><span>{member.email}</span></div>
                {editable ? (
                  <select
                    aria-label={`บทบาทของ ${member.full_name}`}
                    value={member.role}
                    disabled={busy}
                    onChange={(event) => void changeRole(member, event.target.value as FarmRole)}
                  >
                    {roleOptions.map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}
                  </select>
                ) : <span className="registry-status">{roleLabels[member.role]}</span>}
                {editable ? <button className="button button--danger membership-row__revoke" type="button" disabled={busy} onClick={() => void revokeMember(member)}>ถอนสิทธิ์</button> : <span className="membership-row__lock">{member.user_id === currentUserId ? "บัญชีของคุณ" : "คงสิทธิ์เจ้าของ"}</span>}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
