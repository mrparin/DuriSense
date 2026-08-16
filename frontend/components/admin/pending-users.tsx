"use client";

import { AlertCircle, Check, Inbox, LoaderCircle, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";

type PendingUser = { id: string; email: string; full_name: string; phone?: string | null; email_verified_at?: string | null; created_at: string };
type ViewState = "loading" | "ready" | "unauthorized" | "error";

export function PendingUsers() {
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [state, setState] = useState<ViewState>("loading");
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setState("loading");
    try {
      const session = await apiFetch<{ roles: string[] }>("/auth/session");
      if (!session.roles.includes("ADMIN")) { setState("unauthorized"); return; }
      setUsers(await apiFetch<PendingUser[]>("/admin/users/pending"));
      setState("ready");
    } catch (error) {
      setState(error instanceof ApiError && (error.status === 401 || error.status === 403) ? "unauthorized" : "error");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ roles: string[] }>("/auth/session")
      .then((session) => {
        if (!session.roles.includes("ADMIN")) throw new ApiError(403, { code: "ADMIN_REQUIRED", message: "Administrator access is required" });
        return apiFetch<PendingUser[]>("/admin/users/pending");
      })
      .then((items) => { if (!cancelled) { setUsers(items); setState("ready"); } })
      .catch((error) => { if (!cancelled) setState(error instanceof ApiError && (error.status === 401 || error.status === 403) ? "unauthorized" : "error"); });
    return () => { cancelled = true; };
  }, []);

  async function decide(user: PendingUser, action: "approve" | "reject") {
    const reason = action === "reject" ? window.prompt(`ระบุเหตุผลที่ปฏิเสธ ${user.full_name}`) : "ตรวจสอบข้อมูลสมาชิกแล้ว";
    if (reason === null || (action === "reject" && !reason.trim())) return;
    setWorkingId(user.id);
    setNotice("");
    try {
      await apiFetch(`/admin/users/${user.id}/${action}`, { method: "POST", body: JSON.stringify({ reason }) });
      setUsers((current) => current.filter((item) => item.id !== user.id));
      setNotice(action === "approve" ? `อนุมัติบัญชี ${user.full_name} แล้ว` : `ปฏิเสธบัญชี ${user.full_name} แล้ว`);
    } catch { setNotice("ดำเนินการไม่สำเร็จ กรุณาลองใหม่"); }
    finally { setWorkingId(null); }
  }

  if (state === "loading") return <div className="admin-state" role="status"><LoaderCircle className="is-spinning" /><h2>กำลังโหลดคิวสมาชิก</h2></div>;
  if (state === "unauthorized") return <div className="admin-state admin-state--danger"><AlertCircle /><h2>ไม่มีสิทธิ์เข้าถึง</h2><p>กรุณาเข้าสู่ระบบด้วยบัญชี Admin ที่ยืนยัน MFA แล้ว</p></div>;
  if (state === "error") return <div className="admin-state admin-state--danger"><AlertCircle /><h2>โหลดข้อมูลไม่สำเร็จ</h2><button className="button button--secondary" onClick={load}><RefreshCw />ลองอีกครั้ง</button></div>;

  return (
    <>
      <div className="admin-title-row">
        <div><p className="eyebrow">Account review</p><h1>ตรวจสอบสมาชิก</h1><p>อนุมัติหรือปฏิเสธบัญชีที่รอการตรวจสอบ โดยข้อมูลสวนจะไม่แสดงในหน้าสาธารณะ</p></div>
        <button className="admin-icon-button admin-icon-button--light" type="button" onClick={load} title="รีเฟรชคิว" aria-label="รีเฟรชคิว"><RefreshCw /></button>
      </div>
      {notice && <div className="form-status form-status--success" role="status"><Check /><div><strong>{notice}</strong></div></div>}
      {users.length === 0 ? (
        <div className="admin-state"><Inbox /><h2>ไม่มีสมาชิกที่รอตรวจสอบ</h2><p>รายการใหม่จะปรากฏที่นี่เมื่อมีการสมัคร</p></div>
      ) : (
        <div className="admin-user-list" role="list">
          <div className="admin-user-list__head"><span>สมาชิก</span><span>การยืนยัน</span><span>วันที่สมัคร</span><span>คำสั่ง</span></div>
          {users.map((user) => <article key={user.id} className="admin-user-row" role="listitem">
            <div><strong>{user.full_name}</strong><span>{user.email}</span><span>{user.phone || "ไม่ระบุเบอร์โทร"}</span></div>
            <div><span className={user.email_verified_at ? "status-text status-text--ok" : "status-text"}>{user.email_verified_at ? "ยืนยันอีเมลแล้ว" : "ยังไม่ยืนยันอีเมล"}</span></div>
            <time dateTime={user.created_at}>{new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(user.created_at))}</time>
            <div className="admin-user-actions">
              <form onSubmit={(event) => { event.preventDefault(); void decide(user, "approve"); }}><button type="submit" className="button button--primary" disabled={workingId === user.id}><Check />อนุมัติ</button></form>
              <form onSubmit={(event) => { event.preventDefault(); void decide(user, "reject"); }}><button type="submit" className="button button--danger" disabled={workingId === user.id}><X />ปฏิเสธ</button></form>
            </div>
          </article>)}
        </div>
      )}
    </>
  );
}
