import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/require-admin";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true
  }
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return children;
}
