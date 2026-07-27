import type { Metadata } from "next";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { getUserProfile } from "@/lib/auth/get-user";
import { getPaymentConfig, isMercadoPagoConfigured, isTestPaymentEnv } from "@/lib/payments/config";
import { privatePageMetadata } from "@/lib/seo/metadata";
import { redirect } from "next/navigation";

export const metadata: Metadata = privatePageMetadata(
  "Finalizar compra",
  "Confirmá tus datos, entrega y medio de pago de forma segura."
);

export default async function Page() {
  const profile = await getUserProfile();
  if (!profile) redirect("/login?next=/checkout");
  const cardPaymentsEnabled = isMercadoPagoConfigured("card");
  const paymentConfig = getPaymentConfig();
  return (
    <CheckoutForm
      cardPaymentsEnabled={cardPaymentsEnabled}
      cardPublicKey={cardPaymentsEnabled ? paymentConfig.cardPublicKey : ""}
      paymentsTestMode={isTestPaymentEnv()}
      profile={profile}
    />
  );
}
