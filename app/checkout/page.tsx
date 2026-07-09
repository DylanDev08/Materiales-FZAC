import { CheckoutForm } from "@/components/checkout/checkout-form";
import { getUserProfile } from "@/lib/auth/get-user";
import { isTestPaymentEnv } from "@/lib/payments/config";

export default async function Page() {
  const profile = await getUserProfile();
  return <CheckoutForm paymentsTestMode={isTestPaymentEnv()} profile={profile} />;
}
