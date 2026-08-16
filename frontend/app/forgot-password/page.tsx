import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "ลืมรหัสผ่าน",
};

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const params = await searchParams;
  return (
    <AuthShell
      eyebrow="กู้คืนบัญชี"
      title="ตั้งรหัสผ่านใหม่"
      description="ระบุอีเมลที่ใช้สมัครเพื่อรับขั้นตอนตั้งรหัสผ่านใหม่"
    >
      <ForgotPasswordForm rateLimited={params.state === "rate-limited"} />
    </AuthShell>
  );
}
