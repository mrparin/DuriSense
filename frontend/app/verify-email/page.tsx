import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { VerifyEmailStatus } from "@/components/auth/verify-email-status";

export const metadata: Metadata = {
  title: "ยืนยันอีเมล",
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; token?: string }>;
}) {
  const params = await searchParams;

  return (
    <AuthShell
      eyebrow="ยืนยันบัญชี"
      title="ผลการยืนยันอีเมล"
      description="สถานะของลิงก์ยืนยันบัญชี DuriSense"
    >
      <VerifyEmailStatus token={params.token} previewState={params.state} />
    </AuthShell>
  );
}
