import type { Metadata } from "next";
import { DeviceRegistry } from "@/components/farmer/device-registry";

export const metadata: Metadata = { title: "ทะเบียนอุปกรณ์" };

export default function DevicesPage() {
  return <DeviceRegistry />;
}
