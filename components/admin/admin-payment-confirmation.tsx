"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Landmark, MessageCircle } from "lucide-react";
import { getWhatsAppHref } from "@/lib/utils/contact";

type OrderRow = Record<string, string | number | null | undefined>;

export function AdminPaymentConfirmation({ rows }: { rows: OrderRow[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const pendingRows = useMemo(
    () =>
      rows.filter((row) => {
        const status = String(row.__statusRaw ?? "");
        const payment = String(row.__paymentStatus ?? "");
        return payment !== "PAID" && ["COORDINATE", "PENDING_TRANSFER", "PENDING_PAYMENT"].includes(status);
      }),
    [rows]
  );

  async function confirmPayment(id: string) {
    if (busy) return;
    setBusy(id);
    setMessage("");
    const response = await fetch(`/api/admin/orders/${id}/confirm-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    });
    const data = (await response.json().catch(() => ({}))) as { message?: string };
    setBusy(null);
    setMessage(data.message || (response.ok ? "Pago confirmado." : "No pudimos confirmar el pago."));
    if (response.ok) window.location.reload();
  }

  if (!pendingRows.length) return message ? <p className="notice notice--success">{message}</p> : null;

  return (
    <section className="admin-large-purchases" aria-label="Pagos por transferencia pendientes de confirmación">
      {pendingRows.map((row) => (
        <article className="admin-large-purchase-card" key={`payment-${String(row.Id)}`}>
          <div>
            <span className="kicker">TRANSFERENCIA · CONFIRMACIÓN MANUAL</span>
            <h2>{String(row.Cliente || "Cliente")}</h2>
            <p>
              Confirmá únicamente cuando la transferencia figure acreditada. Al confirmar, FZAC genera automáticamente
              las órdenes de compra por proveedor y las deja en borrador para revisión.
            </p>
          </div>
          <strong>{String(row.Total || "-")}</strong>
          <small>{String(row.Productos || "Sin detalle")}</small>
          <div>
            <button
              className="btn"
              type="button"
              disabled={Boolean(busy)}
              onClick={() => void confirmPayment(String(row.Id))}
            >
              {busy === String(row.Id) ? <Landmark size={17} /> : <CheckCircle2 size={17} />}
              {busy === String(row.Id) ? "Confirmando..." : "Pago confirmado"}
            </button>
            <a
              className="btn btn--ghost"
              href={getWhatsAppHref(`Hola ${String(row.Cliente || "")}, te contactamos desde FZAC por el pedido ${String(row.Referencia || "")}.`)}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle size={17} /> WhatsApp
            </a>
          </div>
        </article>
      ))}
      {message ? <p className="notice notice--success" role="status">{message}</p> : null}
    </section>
  );
}
