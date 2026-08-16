"use client";

import { AlertCircle, CheckCircle2, LoaderCircle, Save } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, apiFetch } from "@/lib/api";

type Profile = { email: string; full_name: string; phone?: string | null; timezone: string };

export function ProfileForm() {
  const [saved, setSaved] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    apiFetch<Profile>("/users/me")
      .then(setProfile)
      .catch((error) => setUnauthorized(error instanceof ApiError && error.status === 401))
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaveError(false);
    try {
      const result = await apiFetch<Profile>("/users/me", {
        method: "PATCH",
        body: JSON.stringify({ full_name: form.get("full_name"), phone: form.get("phone") || null, timezone: form.get("timezone") }),
      });
      setProfile(result);
      setSaved(true);
    } catch {
      setSaveError(true);
    }
  }

  if (loading) return <div className="auth-success auth-success--info" role="status"><LoaderCircle className="is-spinning" aria-hidden="true" /><h2>กำลังโหลดโปรไฟล์</h2></div>;
  if (unauthorized || !profile) return <div className="auth-success auth-success--warning" role="alert"><AlertCircle aria-hidden="true" /><h2>กรุณาเข้าสู่ระบบ</h2><p>หน้านี้แสดงข้อมูลของบัญชีที่ยืนยันตัวตนแล้วเท่านั้น</p><Link className="button button--primary button--full" href="/login">ไปหน้าเข้าสู่ระบบ</Link></div>;

  return (
    <>
      {saved && (
        <div className="form-status form-status--success" role="status">
          <CheckCircle2 aria-hidden="true" />
          <div><strong>บันทึกโปรไฟล์แล้ว</strong><span>ข้อมูลบัญชีถูกอัปเดตเรียบร้อย</span></div>
        </div>
      )}
      {saveError && (
        <div className="form-status form-status--danger" role="alert">
          <AlertCircle aria-hidden="true" />
          <div><strong>บันทึกโปรไฟล์ไม่สำเร็จ</strong><span>ตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง</span></div>
        </div>
      )}
      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="profile-email">อีเมลบัญชี</label>
          <input id="profile-email" type="email" value={profile.email} disabled aria-describedby="profile-email-note" />
          <span className="form-field__hint" id="profile-email-note">อีเมลเปลี่ยนผ่านกระบวนการยืนยันแยกต่างหาก</span>
        </div>
        <div className="form-field">
          <label htmlFor="profile-name">ชื่อ-นามสกุล</label>
          <input id="profile-name" name="full_name" type="text" autoComplete="name" defaultValue={profile.full_name} required />
        </div>
        <div className="form-field">
          <label htmlFor="profile-phone">เบอร์โทรศัพท์ <span>(ไม่บังคับ)</span></label>
          <input id="profile-phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" defaultValue={profile.phone ?? ""} />
        </div>
        <div className="form-field">
          <label htmlFor="profile-timezone">เขตเวลา</label>
          <select id="profile-timezone" name="timezone" defaultValue={profile.timezone}>
            <option value="Asia/Bangkok">Asia/Bangkok (UTC+7)</option>
          </select>
        </div>
        <button className="button button--primary button--full button--large" type="submit">
          <Save aria-hidden="true" />
          บันทึกโปรไฟล์
        </button>
      </form>
    </>
  );
}
