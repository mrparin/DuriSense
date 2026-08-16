"use client";

import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, Link2Off, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";

type VerifyState = "loading" | "success" | "expired" | "used" | "invalid";

const states: Record<VerifyState, { icon: typeof CheckCircle2; title: string; description: string }> = {
  loading: {
    icon: LoaderCircle,
    title: "กำลังตรวจสอบลิงก์ยืนยัน",
    description: "โปรดรอสักครู่ระหว่างตรวจสอบสถานะของลิงก์",
  },
  success: {
    icon: CheckCircle2,
    title: "ยืนยันอีเมลสำเร็จ",
    description: "บัญชีของคุณพร้อมเข้าสู่ระบบแล้ว",
  },
  expired: {
    icon: Clock3,
    title: "ลิงก์ยืนยันหมดอายุ",
    description: "ขอลิงก์ใหม่จากหน้าตรวจสอบสถานะการสมัคร",
  },
  used: {
    icon: Link2Off,
    title: "ลิงก์นี้ถูกใช้งานแล้ว",
    description: "หากบัญชีเปิดใช้งานแล้ว สามารถเข้าสู่ระบบได้ตามปกติ",
  },
  invalid: {
    icon: AlertTriangle,
    title: "ลิงก์ยืนยันไม่ถูกต้อง",
    description: "ตรวจสอบลิงก์จากอีเมล หรือขอลิงก์ใหม่อีกครั้ง",
  },
};

export function VerifyEmailStatus({ token, previewState }: { token?: string; previewState?: string }) {
  const allowed: VerifyState[] = ["loading", "success", "expired", "used", "invalid"];
  const preview = allowed.includes(previewState as VerifyState) ? previewState as VerifyState : undefined;
  const [state, setState] = useState<VerifyState>(token ? "loading" : preview ?? "invalid");
  const verificationStarted = useRef(false);

  useEffect(() => {
    if (!token || verificationStarted.current) return;
    verificationStarted.current = true;
    apiFetch("/auth/verify-email", { method: "POST", body: JSON.stringify({ token }) })
      .then(() => setState("success"))
      .catch((error) => {
        if (error instanceof ApiError && error.body.code === "TOKEN_EXPIRED") setState("expired");
        else if (error instanceof ApiError && error.body.code === "TOKEN_USED") setState("used");
        else setState("invalid");
      });
  }, [token]);

  const detail = states[state];
  const Icon = detail.icon;
  const success = state === "success";
  const loading = state === "loading";

  return (
    <div className={`auth-success${success ? "" : loading ? " auth-success--info" : " auth-success--warning"}`} role="status" aria-live="polite">
      <Icon className={loading ? "is-spinning" : undefined} aria-hidden="true" />
      <h2>{detail.title}</h2>
      <p>{detail.description}</p>
      {!loading && (
        <Link className="button button--primary button--full" href={success ? "/login" : "/registration-status"}>
          {success ? "ไปหน้าเข้าสู่ระบบ" : "ตรวจสอบสถานะการสมัคร"}
          <ArrowRight aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
