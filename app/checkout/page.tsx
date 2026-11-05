import type { Metadata } from "next";
import { WhatsAppCheckoutForm } from "@/components/checkout/whatsapp-checkout-form";
import { getUserProfile } from "@/lib/auth/get-user";
import { privatePageMetadata } from "@/lib/seo/metadata";
import { redirect } from "next/navigation";

export const metadata: Metadata = privatePageMetadata(
  "Finalizar compra",
  "Confirmá tu pedido y coordiná disponibilidad, transferencia y entrega por WhatsApp con FZAC."
);

export default async function Page() {
  const profile = await getUserProfile();
  if (!profile) redirect("/login?next=/checkout");

  return <WhatsAppCheckoutForm profile={profile} />;
}
