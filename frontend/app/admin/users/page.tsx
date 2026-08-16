import type { Metadata } from "next";
import { PendingUsers } from "@/components/admin/pending-users";

export const metadata: Metadata = { title: "ตรวจสอบสมาชิก" };
export default function AdminUsersPage() { return <PendingUsers />; }
