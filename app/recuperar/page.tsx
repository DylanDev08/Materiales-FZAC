import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { privatePageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = privatePageMetadata(
  "Recuperar cuenta",
  "Solicitá un enlace seguro para recuperar el acceso a tu cuenta."
);

export default function Page() {
  return <ForgotPasswordForm />;
}
