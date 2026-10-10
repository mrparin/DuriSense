import { Metadata } from "next";
import { AlertsManager } from "@/components/farmer/alerts-manager";
import { FarmerShell } from "@/components/farmer/farmer-shell";

export const metadata: Metadata = {
  title: "ระบบแจ้งเตือนอัจฉริยะ (Alert Operations) | DuriSense",
  description: "ตรวจจับความผิดปกติของสภาพอากาศและความชื้นดินในแปลงทุเรียน พร้อมแจ้งเตือนแบบเรียลไทม์",
};

export default function AlertsPage() {
  return (
    <FarmerShell>
      <AlertsManager />
    </FarmerShell>
  );
}
