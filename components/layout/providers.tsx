"use client";

import { CartProvider } from "@/components/cart/cart-provider";
import { FloatingAssistant } from "@/components/chatbot/floating-assistant";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      {children}
      <FloatingAssistant />
    </CartProvider>
  );
}
