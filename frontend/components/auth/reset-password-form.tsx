"use client";

import { AlertTriangle, ArrowRight, Check, CheckCircle2, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { PasswordField } from "./password-field";
import { ApiError, apiFetch } from "@/lib/api";

type ResetState = "valid" | "expired" | "invalid";

export function ResetPasswordForm({ initialState = "valid", token }: { initialState?: ResetState; token?: string }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "expired" | "invalid">("idle");

  const checks = useMemo(
    () => [
      { label: "อย่างน้อย 10 ตัวอักษร", valid: password.length >= 10 },
      { label: "มีตัวอักษรและตัวเลข", valid: /[A-Za-zก-๙]/.test(password) && /\d/.test(password) },
      { label: "รหัสผ่านตรงกัน", valid: password.length > 0 && password === confirmation },
    ],
    [confirmation, password],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!checks.every((check) => check.valid) || !token) {
      setStatus("invalid");
      return;
    }
    setStatus("submitting");
    try {
      await apiFetch("/auth/password/reset", { method: "POST", body: JSON.stringify({ token, password, password_confirmation: confirmation }) });
      setStatus("success");
    } catch (error) {
      setStatus(error instanceof ApiError && error.body.code === "TOKEN_EXPIRED" ? "expired" : "invalid");
    }
  }

  const tokenState = status === "expired" || status === "invalid" ? status : initialState;
  if (tokenState !== "valid") {
    return (
      <div className="auth-success auth-success--warning" role="alert">
        <AlertTriangle aria-hidden="true" />
        <h2>{tokenState === "expired" ? "ลิงก์ตั้งรหัสผ่านหมดอายุ" : "ลิงก์ตั้งรหัสผ่านไม่ถูกต้อง"}</h2>
        <p>ขอลิงก์ใหม่จากหน้าลืมรหัสผ่าน โดยไม่ใช้ลิงก์เดิมซ้ำ</p>
        <Link className="button button--primary button--full" href="/forgot-password">
          ขอลิงก์ใหม่
          <ArrowRight aria-hidden="true" />
        </Link>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="auth-success" role="status">
        <CheckCircle2 aria-hidden="true" />
        <h2>ตั้งรหัสผ่านใหม่แล้ว</h2>
        <p>รหัสผ่านถูกเปลี่ยนและ session เดิมของบัญชีถูกยกเลิกแล้ว</p>
        <Link className="button button--primary button--full" href="/login">
          ไปหน้าเข้าสู่ระบบ
          <ArrowRight aria-hidden="true" />
        </Link>
      </div>
    );
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <PasswordField id="new-password" name="new_password" label="รหัสผ่านใหม่" autoComplete="new-password" value={password} onChange={setPassword} describedBy="reset-password-requirements" />
      <PasswordField id="new-password-confirmation" name="new_password_confirmation" label="ยืนยันรหัสผ่านใหม่" autoComplete="new-password" value={confirmation} onChange={setConfirmation} describedBy="reset-password-requirements" />
      <ul className="password-requirements" id="reset-password-requirements">
        {checks.map((check) => <li className={check.valid ? "is-valid" : ""} key={check.label}><Check aria-hidden="true" />{check.label}</li>)}
      </ul>
      <button className="button button--primary button--full button--large" type="submit" disabled={status === "submitting"}>
        {status === "submitting" ? <><LoaderCircle className="is-spinning" aria-hidden="true" />กำลังตั้งรหัสผ่าน</> : <>ตั้งรหัสผ่านใหม่<ArrowRight aria-hidden="true" /></>}
      </button>
    </form>
  );
}
