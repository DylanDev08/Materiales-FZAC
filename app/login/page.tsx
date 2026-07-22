import { Suspense } from "react";
import { AuthForm } from "@/components/auth/auth-form";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <AuthForm mode="login" />
    </Suspense>
  );
}
