import { Metadata } from "next";
import { FarmerShell } from "@/components/farmer/farmer-shell";
import { RelayControlCenter } from "@/components/farmer/relay-control-center";

export const metadata: Metadata = {
  title: "ศูนย์ควบคุมรีเลย์ปั๊มน้ำและวาล์ว | DuriSense",
  description: "สั่งงานเปิด-ปิดปั๊มน้ำ สปริงเกลอร์ และวาล์วจ่ายปุ๋ยภาคสนาม Real-Time",
};

export default function RelaysPage() {
  return (
    <FarmerShell>
      <RelayControlCenter />
    </FarmerShell>
  );
}
