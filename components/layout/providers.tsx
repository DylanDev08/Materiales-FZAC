"use client";

import { CartProvider } from "@/components/cart/cart-provider";
import { FloatingAssistant } from "@/components/chatbot/floating-assistant";
import { CookieConsent } from "@/components/privacy/cookie-consent";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      {children}
      <FloatingAssistant />
      <CookieConsent />
    </CartProvider>
  );
}
