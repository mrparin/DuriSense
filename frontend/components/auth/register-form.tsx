"use client";

import { AlertCircle, ArrowRight, Check, CheckCircle2, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";
import { PasswordField } from "./password-field";

type RegisterState = "idle" | "duplicate" | "submitting" | "success";

export function RegisterForm({ initialState = "idle" }: { initialState?: RegisterState }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [status, setStatus] = useState<RegisterState>(initialState);
  const [verificationToken, setVerificationToken] = useState<string | null>(null);

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
    if (checks.every((check) => check.valid)) {
      setStatus("submitting");
      const form = new FormData(event.currentTarget);
      try {
        const result = await apiFetch<{ verification_token?: string | null }>("/auth/register", {
          method: "POST",
          body: JSON.stringify({
            full_name: form.get("full_name"),
            email: form.get("email"),
            phone: form.get("phone") || null,
            farm_name: form.get("farm_name"),
            password,
            password_confirmation: confirmation,
            accept_terms: form.get("accept_terms") === "on",
          }),
        });
        setVerificationToken(result.verification_token ?? null);
        setStatus("success");
      } catch (error) {
        setStatus(error instanceof ApiError && (error.status === 409 || error.status === 429) ? "duplicate" : "idle");
      }
    }
  }

  if (status === "success") {
    return (
      <div className="auth-success" role="status">
        <CheckCircle2 aria-hidden="true" />
        <h2>ส่งคำขอสมัครสมาชิกแล้ว</h2>
        <p>ระบบบันทึกคำขอแล้ว โปรดตรวจอีเมลเพื่อยืนยันบัญชี หรือรอผู้ดูแลระบบอนุมัติ</p>
        {verificationToken && (
          <Link className="button button--secondary button--full" href={`/verify-email?token=${encodeURIComponent(verificationToken)}`}>
            เปิดลิงก์ยืนยันสำหรับการทดสอบ
          </Link>
        )}
        <Link className="button button--primary button--full" href="/registration-status">
          ดูสถานะการสมัคร
          <ArrowRight aria-hidden="true" />
        </Link>
      </div>
    );
  }

  return (
    <>
      {status === "duplicate" && (
        <div className="form-status form-status--danger" role="alert">
          <AlertCircle aria-hidden="true" />
          <div>
            <strong>ไม่สามารถใช้ข้อมูลนี้สมัครซ้ำได้</strong>
            <span>เข้าสู่ระบบหรือใช้เมนูลืมรหัสผ่าน โดยระบบไม่เปิดเผยรายละเอียดของบัญชีเดิม</span>
          </div>
        </div>
      )}
      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-field">
            <label htmlFor="full-name">ชื่อ-นามสกุล</label>
            <input id="full-name" name="full_name" type="text" autoComplete="name" required />
          </div>
          <div className="form-field">
            <label htmlFor="phone">เบอร์โทรศัพท์ <span>(ไม่บังคับ)</span></label>
            <input id="phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" />
          </div>
        </div>

        <div className="form-field">
          <label htmlFor="email">อีเมล</label>
          <input id="email" name="email" type="email" autoComplete="email" placeholder="name@example.com" onChange={() => setStatus("idle")} required />
        </div>

        <div className="form-field">
          <label htmlFor="farm-name">ชื่อสวนเบื้องต้น</label>
          <input id="farm-name" name="farm_name" type="text" autoComplete="organization" required />
        </div>

        <PasswordField
          id="password"
          name="password"
          label="รหัสผ่าน"
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
          describedBy="password-requirements"
        />

        <PasswordField
          id="password-confirmation"
          name="password_confirmation"
          label="ยืนยันรหัสผ่าน"
          autoComplete="new-password"
          value={confirmation}
          onChange={setConfirmation}
          describedBy="password-requirements"
        />

        <ul className="password-requirements" id="password-requirements">
          {checks.map((check) => (
            <li className={check.valid ? "is-valid" : ""} key={check.label}>
              <Check aria-hidden="true" />
              {check.label}
            </li>
          ))}
        </ul>

        <label className="check-control check-control--terms">
          <input type="checkbox" name="accept_terms" required />
          <span>
            ฉันยอมรับ <Link href="/about">เงื่อนไขการใช้งานและนโยบายความเป็นส่วนตัว</Link>
          </span>
        </label>

        <button className="button button--primary button--full button--large" type="submit" disabled={status === "submitting"}>
          {status === "submitting" ? <><LoaderCircle className="is-spinning" aria-hidden="true" />กำลังส่งคำขอ</> : <>สมัครสมาชิก<ArrowRight aria-hidden="true" /></>}
        </button>
      </form>

      <p className="auth-alternate">
        มีบัญชีแล้ว <Link href="/login">เข้าสู่ระบบ</Link>
      </p>
    </>
  );
}
