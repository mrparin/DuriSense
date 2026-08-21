"use client";

import { AlertCircle, ArrowRight, Ban, Clock3, KeyRound, LoaderCircle, ShieldX } from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiFetch } from "@/lib/api";
import { SessionUser, workspacePath } from "@/lib/session";
import { PasswordField } from "./password-field";

type LoginState = "default" | "invalid" | "pending" | "suspended" | "rate-limited" | "mfa" | "submitting";

const loginStates = {
  invalid: {
    icon: AlertCircle,
    title: "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
    detail: "ตรวจสอบข้อมูลแล้วลองอีกครั้ง โดยระบบจะไม่ระบุว่าส่วนใดไม่ถูกต้อง",
    tone: "danger",
  },
  pending: {
    icon: Clock3,
    title: "บัญชียังไม่พร้อมใช้งาน",
    detail: "ตรวจสอบอีเมลยืนยันหรือสถานะการอนุมัติก่อนเข้าสู่ระบบ",
    tone: "warning",
  },
  suspended: {
    icon: ShieldX,
    title: "บัญชีถูกระงับการใช้งาน",
    detail: "ติดต่อผู้ดูแลระบบเพื่อตรวจสอบสถานะบัญชี โดยไม่สมัครบัญชีซ้ำ",
    tone: "danger",
  },
  "rate-limited": {
    icon: Ban,
    title: "มีการเข้าสู่ระบบหลายครั้งเกินไป",
    detail: "โปรดรอสักครู่ก่อนลองใหม่ หรือตั้งรหัสผ่านใหม่หากจำข้อมูลไม่ได้",
    tone: "warning",
  },
  mfa: {
    icon: KeyRound,
    title: "ต้องยืนยันตัวตนสำหรับผู้ดูแลระบบ",
    detail: "กรอกรหัส 6 หลักจากแอปยืนยันตัวตน แล้วเข้าสู่ระบบอีกครั้ง",
    tone: "warning",
  },
} as const;

export function LoginForm({ initialState = "default" }: { initialState?: LoginState }) {
  const [status, setStatus] = useState<LoginState>(initialState);
  const [showOtp, setShowOtp] = useState(false);
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let active = true;
    apiFetch<SessionUser>("/auth/session")
      .then((user) => {
        if (!active) return;
        router.replace(workspacePath(user));
        router.refresh();
      })
      .catch(() => { if (active) setCheckingSession(false); });
    return () => { active = false; };
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setStatus("submitting");
    try {
      const result = await apiFetch<{ user: SessionUser }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
          otp: form.get("otp") || null,
          recovery_code: form.get("recovery_code") || null,
        }),
      });
      router.replace(workspacePath(result.user));
      router.refresh();
    } catch (error) {
      if (!(error instanceof ApiError)) {
        setStatus("invalid");
        return;
      }
      if (error.body.code === "MFA_REQUIRED") {
        setShowOtp(true);
        setStatus("mfa");
      } else if (error.body.code.includes("PENDING") || error.body.code.includes("REJECTED")) {
        setStatus("pending");
      } else if (error.body.code.includes("SUSPENDED")) {
        setStatus("suspended");
      } else if (error.status === 429) {
        setStatus("rate-limited");
      } else {
        setStatus("invalid");
      }
    }
  }

  const statusDetail = status !== "default" && status !== "submitting" ? loginStates[status] : null;
  const StatusIcon = statusDetail?.icon;

  if (checkingSession) return <div className="auth-success auth-success--info" role="status"><LoaderCircle className="is-spinning" aria-hidden="true" /><h2>กำลังตรวจสอบการเข้าสู่ระบบ</h2><p>หาก session ยังใช้งานได้ ระบบจะพากลับไปยังพื้นที่ทำงานโดยอัตโนมัติ</p></div>;

  return (
    <>
      {statusDetail && StatusIcon && (
        <div className={`form-status form-status--${statusDetail.tone}`} role="alert">
          <StatusIcon aria-hidden="true" />
          <div>
            <strong>{statusDetail.title}</strong>
            <span>{statusDetail.detail}</span>
          </div>
        </div>
      )}

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="email">อีเมล</label>
          <input id="email" name="email" type="email" autoComplete="email" placeholder="name@example.com" onChange={() => setStatus("default")} required />
        </div>

        <PasswordField id="password" name="password" label="รหัสผ่าน" autoComplete="current-password" />

        {showOtp && (
          <div className="form-field">
            <label htmlFor={useRecoveryCode ? "recovery_code" : "otp"}>{useRecoveryCode ? "รหัสกู้คืน Admin" : "รหัสยืนยันสำหรับ Admin"}</label>
            {useRecoveryCode ? (
              <>
                <input id="recovery_code" name="recovery_code" type="text" autoComplete="one-time-code" placeholder="XXXXXX-XXXXXX" pattern="[A-Fa-f0-9]{6}-[A-Fa-f0-9]{6}" maxLength={13} aria-describedby="recovery-code-hint" required />
                <span className="form-field__hint" id="recovery-code-hint">กรอกครบ 13 ตัวอักษร รวมเครื่องหมายขีด และแต่ละรหัสใช้ได้เพียงครั้งเดียว</span>
              </>
            ) : (
              <input id="otp" name="otp" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required />
            )}
            <button className="text-action" type="button" onClick={() => setUseRecoveryCode((value) => !value)}>
              {useRecoveryCode ? "ใช้รหัสจากแอปยืนยันตัวตน" : "ใช้รหัสกู้คืนแทน"}
            </button>
          </div>
        )}

        <div className="form-options">
          <label className="check-control">
            <input type="checkbox" name="remember" />
            <span>จดจำการเข้าสู่ระบบ</span>
          </label>
          <Link href="/forgot-password">ลืมรหัสผ่าน</Link>
        </div>

        <button className="button button--primary button--full button--large" type="submit" disabled={status === "submitting"}>
          {status === "submitting" ? <><LoaderCircle className="is-spinning" aria-hidden="true" />กำลังเข้าสู่ระบบ</> : <>เข้าสู่ระบบ<ArrowRight aria-hidden="true" /></>}
        </button>
      </form>

      <p className="auth-alternate">
        ยังไม่มีบัญชี <Link href="/register">สมัครสมาชิก</Link>
      </p>
    </>
  );
}
