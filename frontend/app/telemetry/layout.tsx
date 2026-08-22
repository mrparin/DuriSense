import type { Metadata } from "next";
import { FarmerShell } from "@/components/farmer/farmer-shell";

export const metadata: Metadata = { title: "ข้อมูลตรวจวัดและสถิติสวน" };

export default function TelemetryLayout({ children }: { children: React.ReactNode }) {
  return <FarmerShell>{children}</FarmerShell>;
}
