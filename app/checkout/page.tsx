import { CheckoutForm } from "@/components/checkout/checkout-form";
import { getUserProfile } from "@/lib/auth/get-user";
import { getPaymentConfig, isMercadoPagoConfigured, isTestPaymentEnv } from "@/lib/payments/config";
import { redirect } from "next/navigation";

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
