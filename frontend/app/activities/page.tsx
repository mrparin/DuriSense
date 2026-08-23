import { Metadata } from "next";
import { ActivityTracker } from "@/components/farmer/activity-tracker";
import { FarmerShell } from "@/components/farmer/farmer-shell";

export const metadata: Metadata = {
  title: "บันทึกกิจกรรมการดูแลสวน | DuriSense",
  description: "บันทึกและติดตามประวัติการให้น้ำ ใส่ปุ๋ย ฉีดพ่นสาร ตัดแต่งกิ่ง และผลผลิตเก็บเกี่ยว",
};

export default function ActivitiesPage() {
  return (
    <FarmerShell>
      <ActivityTracker />
    </FarmerShell>
  );
}
