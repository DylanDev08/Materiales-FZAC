import type { Metadata } from "next";
import { AdminMfaGate } from "@/components/auth/admin-mfa-gate";
import { requireAdminIdentity } from "@/lib/auth/require-admin";
import { getAdminConsolePath } from "@/lib/utils/env";
import { safeInternalPath } from "@/lib/utils/navigation";
import { privatePageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = privatePageMetadata(
  "Verificación administrativa",
  "Segundo factor obligatorio para el panel de Materiales FZAC."
);

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Page({
  searchParams
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  await requireAdminIdentity();
  const params = await searchParams;
  const nextPath = safeInternalPath(params.next, getAdminConsolePath());

  return <AdminMfaGate nextPath={nextPath} />;
}
