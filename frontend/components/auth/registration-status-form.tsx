"use client";

import { AlertCircle, CheckCircle2, Clock3, LoaderCircle, Mail, RefreshCw } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";

type RegistrationState = "default" | "pending" | "active" | "rejected";

const registrationStates = {
  pending: {
    icon: Clock3,
    label: "รอการยืนยัน",
    detail: "บัญชีกำลังรอการยืนยันอีเมล หรือการอนุมัติโดยผู้ดูแลระบบ",
    tone: "warning",
  },
  active: {
    icon: CheckCircle2,
    label: "พร้อมใช้งาน",
    detail: "บัญชีได้รับการยืนยันแล้ว สามารถเข้าสู่ระบบได้",
    tone: "success",
  },
  rejected: {
    icon: AlertCircle,
    label: "คำขอไม่ได้รับการอนุมัติ",
    detail: "ตรวจข้อมูลที่ใช้สมัครและติดต่อผู้ดูแลระบบก่อนส่งคำขอใหม่",
    tone: "danger",
  },
} as const;

export function RegistrationStatusForm({ initialState = "default" }: { initialState?: RegistrationState }) {
  const [status, setStatus] = useState<RegistrationState>(initialState);
  const [resent, setResent] = useState(false);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const address = String(form.get("email"));
    setEmail(address);
    setSubmitting(true);
    setResent(false);
    try {
      const result = await apiFetch<{ status?: "PENDING_VERIFICATION" | "ACTIVE" | "REJECTED" | null }>("/auth/registration-status", {
        method: "POST",
        body: JSON.stringify({ email: address }),
      });
      const mapped = result.status === "ACTIVE" ? "active" : result.status === "REJECTED" ? "rejected" : "pending";
      setStatus(mapped);
    } catch (error) {
      if (error instanceof ApiError && error.status === 429) setStatus("pending");
    } finally {
      setSubmitting(false);
    }
  }

  async function resend() {
    await apiFetch("/auth/resend-verification", { method: "POST", body: JSON.stringify({ email }) });
    setResent(true);
  }

  const detail = status === "default" ? null : registrationStates[status];
  const StatusIcon = detail?.icon;

  return (
    <>
      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="email">อีเมลที่ใช้สมัคร</label>
          <input id="email" name="email" type="email" autoComplete="email" placeholder="name@example.com" required />
        </div>
        <button className="button button--primary button--full button--large" type="submit" disabled={submitting}>
          {submitting ? <><LoaderCircle className="is-spinning" aria-hidden="true" />กำลังตรวจสอบ</> : "ตรวจสอบสถานะ"}
        </button>
      </form>

      {detail && StatusIcon && (
        <div className={`registration-result registration-result--${detail.tone}`} role="status">
          <div className="registration-result__heading">
            <StatusIcon aria-hidden="true" />
            <div>
              <span>สถานะบัญชี</span>
              <strong>{detail.label}</strong>
            </div>
          </div>
          <p>{detail.detail}</p>
          {status === "active" && <Link className="button button--primary button--full" href="/login">ไปหน้าเข้าสู่ระบบ</Link>}
          {status === "pending" && (resent ? (
            <p className="inline-success"><Mail aria-hidden="true" />ส่งลิงก์ยืนยันอีกครั้งแล้ว</p>
          ) : (
            <button className="button button--secondary button--full" type="button" onClick={resend}>
              <RefreshCw aria-hidden="true" />
              ส่งลิงก์ยืนยันอีกครั้ง
            </button>
          ))}
        </div>
      )}
    </>
  );
}
