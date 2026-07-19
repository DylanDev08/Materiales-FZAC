import { redirect } from "next/navigation";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { getCurrentUser } from "@/lib/auth/get-user";

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/recuperar?expired=true");
  return <ResetPasswordForm />;
}
