import type { Metadata } from "next";
import { AdminMfaSetup } from "@/components/auth/admin-mfa-setup";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getAdminConsolePath } from "@/lib/utils/env";
import { privatePageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = privatePageMetadata(
  "Seguridad administrativa",
  "Verificacion en dos pasos para administradores de Materiales FZAC."
);

export const dynamic = "force-dynamic";

export default async function AdminSecurityPage() {
  await requireAdmin();
  return <AdminMfaSetup adminPath={getAdminConsolePath()} />;
}
