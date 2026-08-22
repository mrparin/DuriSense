import type { Metadata } from "next";
import { TelemetryDashboard } from "@/components/farmer/telemetry-dashboard";

export const metadata: Metadata = {
  title: "ข้อมูลตรวจวัดและสถิติสวน | DuriSense",
  description: "แดชบอร์ดติดตามสภาพอากาศและสุขภาพดินตามเวลาจริง",
};

export default function TelemetryPage() {
  return <TelemetryDashboard />;
}
