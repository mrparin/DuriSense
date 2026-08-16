"use client";

import { AlertCircle, CheckCircle2, KeyRound, LoaderCircle, RotateCcw } from "lucide-react";
import { FormEvent, useState } from "react";
import { apiFetch } from "@/lib/api";

type Setup = { challenge_token: string; secret: string; provisioning_uri: string };

export function MfaSecurity() {
  const [setup, setSetup] = useState<Setup | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function begin() {
    setBusy(true); setError(""); setCodes([]);
    try { setSetup(await apiFetch<Setup>("/auth/mfa/setup", { method: "POST" })); }
    catch { setError("เริ่มตั้งค่า MFA ไม่สำเร็จ กรุณาเข้าสู่ระบบใหม่"); }
    finally { setBusy(false); }
  }

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!setup) return;
    const form = new FormData(event.currentTarget);
    setBusy(true); setError("");
    try {
      const result = await apiFetch<{ recovery_codes: string[] }>("/auth/mfa/confirm", { method: "POST", body: JSON.stringify({ challenge_token: setup.challenge_token, otp: form.get("otp") }) });
      setCodes(result.recovery_codes); setSetup(null);
    } catch { setError("รหัสยืนยันไม่ถูกต้องหรือหมดอายุ"); }
    finally { setBusy(false); }
  }

  return (
    <>
      <div className="admin-title-row"><div><p className="eyebrow">Administrator security</p><h1>ความปลอดภัย Admin</h1><p>หมุนรหัส TOTP และสร้าง recovery code ชุดใหม่เมื่ออุปกรณ์เปลี่ยนหรือรหัสเดิมไม่ปลอดภัย</p></div></div>
      {error && <div className="form-status form-status--danger"><AlertCircle /><div><strong>{error}</strong></div></div>}
      <section className="security-workflow">
        <div className="security-workflow__summary"><KeyRound /><div><h2>Authenticator และรหัสกู้คืน</h2><p>การยืนยันจะยกเลิก recovery code ชุดเดิมทันที และ session อื่นของบัญชีจะถูกเพิกถอน</p></div><button className="button button--secondary" onClick={begin} disabled={busy}>{busy ? <LoaderCircle className="is-spinning" /> : <RotateCcw />}หมุน MFA</button></div>
        {setup && <form className="security-enrollment" onSubmit={confirm}>
          <div><strong>1. เพิ่มบัญชีในแอป Authenticator</strong><p>ชื่อบัญชี DuriSense ใช้ secret ด้านล่าง กรอกด้วยตนเองหรือเปิด provisioning URI บนอุปกรณ์ที่รองรับ</p><code>{setup.secret}</code><a href={setup.provisioning_uri}>เปิดในแอป Authenticator</a></div>
          <div className="form-field"><label htmlFor="mfa-otp">2. ยืนยันรหัส 6 หลัก</label><input id="mfa-otp" name="otp" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" required /><button className="button button--primary" disabled={busy}>{busy ? <LoaderCircle className="is-spinning" /> : <CheckCircle2 />}ยืนยันและสร้างรหัสกู้คืน</button></div>
        </form>}
        {codes.length > 0 && <div className="recovery-result" role="status"><h2>บันทึกรหัสกู้คืนชุดนี้ไว้ในที่ปลอดภัย</h2><p>ระบบจะแสดงเพียงครั้งเดียว แต่ละรหัสใช้เข้าสู่ระบบได้หนึ่งครั้ง</p><div>{codes.map((code) => <code key={code}>{code}</code>)}</div></div>}
      </section>
    </>
  );
}
