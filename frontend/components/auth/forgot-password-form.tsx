"use client";

import { ArrowRight, LoaderCircle, MailCheck, TimerReset } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";

export function ForgotPasswordForm({ rateLimited = false }: { rateLimited?: boolean }) {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [limited, setLimited] = useState(rateLimited);
  const [resetToken, setResetToken] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    try {
      const result = await apiFetch<{ development_token?: string | null }>("/auth/password/forgot", {
        method: "POST",
        body: JSON.stringify({ email: form.get("email") }),
      });
      setResetToken(result.development_token ?? null);
      setSubmitted(true);
    } catch (error) {
      if (error instanceof ApiError && error.status === 429) setLimited(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="auth-success" role="status">
        <MailCheck aria-hidden="true" />
        <h2>ตรวจสอบอีเมลของคุณ</h2>
        <p>หากอีเมลนี้อยู่ในระบบ เราจะส่งขั้นตอนตั้งรหัสผ่านใหม่ให้ โดยไม่เปิดเผยว่ามีบัญชีอยู่หรือไม่</p>
        {resetToken && <Link className="button button--secondary button--full" href={`/reset-password?token=${encodeURIComponent(resetToken)}`}>เปิดลิงก์กู้คืนสำหรับการทดสอบ</Link>}
        <Link className="button button--primary button--full" href="/login">
          กลับไปเข้าสู่ระบบ
          <ArrowRight aria-hidden="true" />
        </Link>
      </div>
    );
  }

  return (
    <>
      {limited && (
        <div className="form-status form-status--warning" role="alert">
          <TimerReset aria-hidden="true" />
          <div><strong>ส่งคำขอหลายครั้งเกินไป</strong><span>โปรดรอก่อนส่งคำขอใหม่ ข้อความเดิมที่ได้รับยังใช้ได้จนกว่าจะหมดอายุ</span></div>
        </div>
      )}
      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="email">อีเมลที่ใช้สมัคร</label>
          <input id="email" name="email" type="email" autoComplete="email" placeholder="name@example.com" required />
        </div>
        <button className="button button--primary button--full button--large" type="submit" disabled={limited || submitting}>
          {submitting ? <><LoaderCircle className="is-spinning" aria-hidden="true" />กำลังส่งคำขอ</> : <>ส่งลิงก์ตั้งรหัสผ่านใหม่<ArrowRight aria-hidden="true" /></>}
        </button>
      </form>
    </>
  );
}
