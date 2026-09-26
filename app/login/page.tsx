import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { getUserProfile } from "@/lib/auth/get-user";
import { privatePageMetadata } from "@/lib/seo/metadata";
import { getAdminConsolePath } from "@/lib/utils/env";

export const metadata: Metadata = privatePageMetadata(
  "Ingresar",
  "Accedé de forma segura a tu cuenta de Materiales FZAC."
);

export default async function Page() {
  const profile = await getUserProfile();
  if (profile) {
    if (profile.role === "ADMIN") {
      redirect(`/seguridad/admin-mfa?next=${encodeURIComponent(getAdminConsolePath())}`);
    }
    redirect("/cuenta");
  }

  return (
    <Suspense fallback={null}>
      <AuthForm mode="login" />
    </Suspense>
  );
}
