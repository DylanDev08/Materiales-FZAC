"use client";

import { useEffect } from "react";
import { MessageCircle } from "lucide-react";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import type { SessionProfile } from "@/lib/auth/get-user";

export function WhatsAppCheckoutForm({ profile }: { profile: SessionProfile | null }) {
  useEffect(() => {
    const selectWhatsApp = () => {
      const button = document.querySelector<HTMLButtonElement>(
        ".fzac-whatsapp-checkout .payment-mode-button--whatsapp"
      );
      if (button && button.getAttribute("aria-pressed") !== "true" && !button.disabled) {
        button.click();
      }
    };

    selectWhatsApp();
    const observer = new MutationObserver(selectWhatsApp);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="fzac-whatsapp-checkout">
      <div className="container" style={{ marginBottom: 18 }}>
        <div className="notice notice--success">
          <MessageCircle size={18} />
          <div>
            <strong>Pago coordinado por WhatsApp</strong>
            <p>
              Confirmás el pedido en FZAC y te llevamos a WhatsApp con el detalle y el total. Ahí te enviamos los datos
              para realizar la transferencia.
            </p>
          </div>
        </div>
      </div>
      <CheckoutForm cardPaymentsEnabled={false} cardPublicKey="" paymentsTestMode={false} profile={profile} />
      <style jsx global>{`
        .fzac-whatsapp-checkout .payment-choice-head,
        .fzac-whatsapp-checkout .payment-mode-grid,
        .fzac-whatsapp-checkout .payment-env-badge {
          display: none !important;
        }
      `}</style>
    </div>
  );
}
