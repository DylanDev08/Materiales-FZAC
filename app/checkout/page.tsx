import { CheckoutForm } from "@/components/checkout/checkout-form";
import { getUserProfile } from "@/lib/auth/get-user";
import { isMercadoPagoConfigured, isTestPaymentEnv } from "@/lib/payments/config";
import { redirect } from "next/navigation";

export default async function Page() {
  const profile = await getUserProfile();
  if (!profile) redirect("/login?next=/checkout");
  return (
    <CheckoutForm
      cardPaymentsEnabled={isMercadoPagoConfigured("card")}
      paymentsTestMode={isTestPaymentEnv()}
      profile={profile}
    />
  );
}
