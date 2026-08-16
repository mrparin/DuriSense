import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = {
  title: "สมัครสมาชิก",
};

type RegisterState = "idle" | "duplicate";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const params = await searchParams;
  const state: RegisterState = params.state === "duplicate" ? "duplicate" : "idle";

  return (
    <AuthShell
      eyebrow="สร้างพื้นที่จัดการสวน"
      title="สมัครสมาชิก DuriSense"
      description="กรอกข้อมูลเบื้องต้นเพื่อส่งคำขอเปิดใช้งานบัญชี"
    >
      <RegisterForm initialState={state} />
    </AuthShell>
  );
}
