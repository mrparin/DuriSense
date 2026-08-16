import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { ProfileForm } from "@/components/auth/profile-form";

export const metadata: Metadata = {
  title: "โปรไฟล์ผู้ใช้",
};

export default function ProfilePage() {
  return (
    <AuthShell eyebrow="ข้อมูลบัญชี" title="โปรไฟล์ผู้ใช้" description="ตรวจและแก้ไขข้อมูลติดต่อของบัญชีโดยไม่แสดงข้อมูลสวนในหน้าสาธารณะ">
      <ProfileForm />
    </AuthShell>
  );
}
