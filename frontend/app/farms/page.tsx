import type { Metadata } from "next";
import { FarmWorkspace } from "@/components/farmer/farm-workspace";

export const metadata: Metadata = { title: "สวนและแปลง" };

export default function FarmsPage() {
  return <FarmWorkspace />;
}
