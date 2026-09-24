import type { Metadata } from "next";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { getUserProfile } from "@/lib/auth/get-user";
import { getPaymentConfig, isTestPaymentEnv } from "@/lib/payments/config";
import { privatePageMetadata } from "@/lib/seo/metadata";
import { redirect } from "next/navigation";

export const metadata: Metadata = privatePageMetadata(
  "Finalizar compra",
  "Confirmá tus datos, entrega y medio de pago de forma segura."
);

export default async function Page() {
  const profile = await getUserProfile();
  if (!profile) redirect("/login?next=/checkout");
  const paymentConfig = getPaymentConfig();
  const productionCardPublicKey =
    process.env.NEXT_PUBLIC_MERCADOPAGO_PRODUCTION_CARD_PUBLIC_KEY?.trim() ||
    process.env.NEXT_PUBLIC_MERCADOPAGO_PRODUCTION_PUBLIC_KEY?.trim() ||
    "";
  const cardPublicKey = productionCardPublicKey || paymentConfig.cardPublicKey;
  return (
    <CheckoutForm
      cardPaymentsEnabled={false}
      cardPublicKey={cardPublicKey}
      paymentsTestMode={productionCardPublicKey ? false : isTestPaymentEnv()}
      profile={profile}
    />
  );
}
