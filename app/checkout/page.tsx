import type { Metadata } from "next";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { getUserProfile } from "@/lib/auth/get-user";
import { privatePageMetadata } from "@/lib/seo/metadata";
import { redirect } from "next/navigation";

export const metadata: Metadata = privatePageMetadata(
  "Finalizar compra",
  "Pagá online con Mercado Pago o por transferencia enviando el comprobante a FZAC por WhatsApp."
);

export default async function Page() {
  const profile = await getUserProfile();
  if (!profile) redirect("/login?next=/checkout");

  return <CheckoutForm profile={profile} />;
}
