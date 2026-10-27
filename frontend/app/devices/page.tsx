import type { Metadata } from "next";
import { DevicesWorkspace } from "@/components/farmer/devices-workspace";

export const metadata: Metadata = {
  title: "สุขภาพอุปกรณ์ & ทะเบียนอุปกรณ์ | DuriSense",
  description: "ตรวจสอบสุขภาพอุปกรณ์ ระดับแบตเตอรี่ สัญญาณ RSSI และรายงานข้อมูลขาดช่วง",
};

export default function DevicesPage() {
  return <DevicesWorkspace />;
}
