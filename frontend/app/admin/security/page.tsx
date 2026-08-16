import type { Metadata } from "next";
import { MfaSecurity } from "@/components/admin/mfa-security";

export const metadata: Metadata = { title: "ความปลอดภัย Admin" };
export default function AdminSecurityPage() { return <MfaSecurity />; }
