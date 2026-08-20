import { FarmerShell } from "@/components/farmer/farmer-shell";

export default function FarmsLayout({ children }: { children: React.ReactNode }) {
  return <FarmerShell>{children}</FarmerShell>;
}
