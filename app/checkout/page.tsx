import { CheckoutForm } from "@/components/checkout/checkout-form";
import { getUserProfile } from "@/lib/auth/get-user";
import { isTestPaymentEnv } from "@/lib/payments/config";
import { redirect } from "next/navigation";

export default async function Page() {
  const profile = await getUserProfile();
  if (!profile) redirect("/login?next=/checkout");
  return <CheckoutForm paymentsTestMode={isTestPaymentEnv()} profile={profile} />;
}
