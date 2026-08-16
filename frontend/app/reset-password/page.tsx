import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = {
  title: "ตั้งรหัสผ่านใหม่",
};

type ResetState = "valid" | "expired" | "invalid";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ state?: string; token?: string }> }) {
  const params = await searchParams;
  const allowedStates: ResetState[] = ["valid", "expired", "invalid"];
  const state = allowedStates.includes(params.state as ResetState) ? (params.state as ResetState) : "valid";

  return (
    <AuthShell eyebrow="กู้คืนบัญชี" title="ตั้งรหัสผ่านใหม่" description="กำหนดรหัสผ่านใหม่จากลิงก์กู้คืนบัญชีที่ยังใช้งานได้">
      <ResetPasswordForm initialState={state} token={params.token} />
    </AuthShell>
  );
}
