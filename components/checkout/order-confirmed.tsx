"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, MessageCircle, PackageCheck, Truck } from "lucide-react";
import { currency } from "@/lib/formatters/currency";
import { getWhatsAppHref } from "@/lib/utils/contact";
import type { ShippingMethod } from "@/types/domain";

type LastOrderSnapshot = {
  orderId: string;
  whatsappUrl?: string;
  total?: number;
  shippingMethod?: ShippingMethod;
  message?: string;
  createdAt?: number;
  redirectedAt?: number;
};

const LAST_ORDER_KEY = "fzac.checkout.lastOrder.v1";

export function OrderConfirmed({ orderId }: { orderId: string }) {
  const [snapshot, setSnapshot] = useState<LastOrderSnapshot | null>(null);
  const reference = useMemo(() => orderId.slice(0, 8).toUpperCase(), [orderId]);
  const fallbackWhatsApp = getWhatsAppHref(
    `Hola FZAC, generé el pedido ${reference} y quiero coordinar stock, transferencia y ${snapshot?.shippingMethod === "DELIVERY" ? "envío" : "retiro"}.`
  );
  const whatsappUrl = snapshot?.whatsappUrl || fallbackWhatsApp;

  useEffect(() => {
    try {
      const parsed = JSON.parse(window.sessionStorage.getItem(LAST_ORDER_KEY) || "null") as LastOrderSnapshot | null;
      if (parsed?.orderId === orderId) setSnapshot(parsed);
    } catch {
      setSnapshot(null);
    }
  }, [orderId]);

  useEffect(() => {
    if (!snapshot?.whatsappUrl || snapshot.redirectedAt) return;
    const timer = window.setTimeout(() => {
      const updated = { ...snapshot, redirectedAt: Date.now() };
      window.sessionStorage.setItem(LAST_ORDER_KEY, JSON.stringify(updated));
      setSnapshot(updated);
      window.location.assign(snapshot.whatsappUrl!);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [snapshot]);

  return (
    <main className="page-section">
      <div className="container">
        <section className="checkout-panel" style={{ maxWidth: 760, margin: "0 auto" }}>
          <div className="notice notice--success">
            <CheckCircle2 size={22} />
            <div>
              <strong>Pedido generado correctamente</strong>
              <p>{snapshot?.message || "Tu pedido quedó registrado. El siguiente paso es coordinarlo con FZAC por WhatsApp."}</p>
            </div>
          </div>

          <div className="section-head" style={{ marginTop: 22 }}>
            <div>
              <span className="kicker">Referencia FZAC</span>
              <h1>#{reference}</h1>
              <p>Guardá esta referencia por si necesitás retomar la conversación o consultar el estado.</p>
            </div>
          </div>

          <div className="checkout-confidence" aria-label="Resumen del pedido">
            {typeof snapshot?.total === "number" ? (
              <div><PackageCheck size={18} /><span><strong>{currency(snapshot.total)}</strong> total registrado</span></div>
            ) : null}
            <div><Truck size={18} /><span><strong>{snapshot?.shippingMethod === "DELIVERY" ? "Envío" : "Retiro"}</strong> a coordinar con FZAC</span></div>
            <div><MessageCircle size={18} /><span><strong>WhatsApp</strong> para stock y transferencia</span></div>
          </div>

          <div className="checkout-panel__actions" style={{ marginTop: 24 }}>
            <a className="btn" href={whatsappUrl} target="_blank" rel="noreferrer">
              <MessageCircle size={18} /> Abrir WhatsApp
            </a>
            <Link className="btn btn--ghost" href="/cuenta/pedidos">
              Ver mis pedidos
            </Link>
            <Link className="btn btn--ghost" href="/productos">
              Seguir comprando
            </Link>
          </div>

          <p className="checkout-summary__payment" style={{ marginTop: 18 }}>
            Si WhatsApp no se abre automáticamente, usá el botón “Abrir WhatsApp”. El pedido ya quedó registrado y no necesitás generarlo otra vez.
          </p>
        </section>
      </div>
    </main>
  );
}
