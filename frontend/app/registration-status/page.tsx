import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { RegistrationStatusForm } from "@/components/auth/registration-status-form";

export const metadata: Metadata = {
  title: "สถานะการสมัคร",
};

type RegistrationState = "default" | "pending" | "active" | "rejected";

export default async function RegistrationStatusPage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const params = await searchParams;
  const allowedStates: RegistrationState[] = ["default", "pending", "active", "rejected"];
  const state = allowedStates.includes(params.state as RegistrationState)
    ? (params.state as RegistrationState)
    : "default";

  return (
    <AuthShell
      eyebrow="ติดตามคำขอ"
      title="ตรวจสอบสถานะการสมัคร"
      description="ดูสถานะการยืนยันอีเมลหรือการอนุมัติโดยผู้ดูแลระบบ"
    >
      <RegistrationStatusForm initialState={state} />
    </AuthShell>
  );
}
