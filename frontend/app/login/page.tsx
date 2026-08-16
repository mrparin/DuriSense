import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "เข้าสู่ระบบ",
};

type LoginState = "default" | "invalid" | "pending" | "suspended" | "rate-limited";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const params = await searchParams;
  const allowedStates: LoginState[] = ["default", "invalid", "pending", "suspended", "rate-limited"];
  const state = allowedStates.includes(params.state as LoginState) ? (params.state as LoginState) : "default";

  return (
    <AuthShell
      eyebrow="ยินดีต้อนรับกลับ"
      title="เข้าสู่ระบบ DuriSense"
      description="เข้าถึงข้อมูลสวน อุปกรณ์ และการแจ้งเตือนตามสิทธิ์ของคุณ"
    >
      <LoginForm initialState={state} />
    </AuthShell>
  );
}
