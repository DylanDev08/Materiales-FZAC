"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function PaymentReturnReconciler({
  orderId,
  paymentId
}: {
  orderId: string;
  paymentId: string;
}) {
  const router = useRouter();
  const started = useRef(false);
  const [message, setMessage] = useState("Verificando el pago con Mercado Pago...");

  useEffect(() => {
    if (!orderId || !paymentId || started.current) return;
    started.current = true;

    const controller = new AbortController();

    void fetch("/api/payments/mercadopago/reconcile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, paymentId }),
      signal: controller.signal,
      cache: "no-store"
    })
      .then(async (response) => {
        const data = (await response.json().catch(() => ({}))) as {
          status?: string;
          message?: string;
        };

        if (data.status === "PAID") {
          setMessage("Pago confirmado. Estamos actualizando tu comprobante...");
          router.refresh();
          return;
        }

        if (data.status === "PENDING_ADMIN_APPROVAL") {
          setMessage("La compra requiere revisión prioritaria antes de habilitar el pago.");
          return;
        }

        if (data.status === "FAILED" || data.status === "EXPIRED") {
          router.replace(`/pago/rechazado?order_id=${encodeURIComponent(orderId)}`);
          return;
        }

        setMessage(data.message || "El pago todavía está siendo confirmado.");
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setMessage("Estamos esperando la confirmación automática de Mercado Pago.");
        }
      });

    return () => controller.abort();
  }, [orderId, paymentId, router]);

  return <p className="payment-return-status" aria-live="polite">{message}</p>;
}
