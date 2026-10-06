"use client";

import { MessageCircle } from "lucide-react";
import { WhatsAppOrderForm } from "@/components/checkout/whatsapp-order-form";
import type { SessionProfile } from "@/lib/auth/get-user";

export function WhatsAppCheckoutForm({ profile }: { profile: SessionProfile | null }) {
  return (
    <div className="fzac-whatsapp-checkout">
      <div className="container" style={{ marginBottom: 18 }}>
        <div className="notice notice--success">
          <MessageCircle size={18} />
          <div>
            <strong>Pedido coordinado por WhatsApp</strong>
            <p>
              Confirmás el pedido en FZAC y después te llevamos a WhatsApp con la referencia. Ahí coordinamos stock,
              transferencia y entrega o retiro.
            </p>
          </div>
        </div>
      </div>
      <WhatsAppOrderForm profile={profile} />
    </div>
  );
}
