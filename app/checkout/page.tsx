import { CheckoutForm } from "@/components/checkout/checkout-form";
import { getUserProfile } from "@/lib/auth/get-user";

export default async function Page() {
  const profile = await getUserProfile();
  return <CheckoutForm profile={profile} />;
}
