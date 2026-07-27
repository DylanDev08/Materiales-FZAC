import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { getCurrentUser } from "@/lib/auth/get-user";
import { privatePageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = privatePageMetadata(
  "Restablecer contraseña",
  "Elegí una nueva contraseña para tu cuenta de Materiales FZAC."
);

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/recuperar?expired=true");
  return <ResetPasswordForm />;
}
