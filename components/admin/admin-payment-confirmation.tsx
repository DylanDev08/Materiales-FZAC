"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, FileCheck2, Landmark, MapPinned, MessageCircle } from "lucide-react";
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
      {pendingRows.map((row) => {
        const proofMediaId = String(row.__proofMediaId || "");
        const proofStatus = String(row.__proofStatus || "");
        const latitude = String(row.__whatsappLatitude || "");
        const longitude = String(row.__whatsappLongitude || "");
        const exactLocationHref = latitude && longitude
          ? `https://www.google.com/maps?q=${encodeURIComponent(`${latitude},${longitude}`)}`
          : "";

        return (
          <article className="admin-large-purchase-card" key={`payment-${String(row.Id)}`}>
            <div>
              <span className="kicker">WHATSAPP · PAGO PENDIENTE DE VALIDACIÓN</span>
              <h2>{String(row.Cliente || "Cliente")}</h2>
              <p>
                Confirmá únicamente cuando la transferencia figure acreditada. Al aprobarla, FZAC genera automáticamente
                las órdenes de compra por proveedor y las deja en borrador para revisión.
              </p>
              {proofMediaId ? (
                <span className="status-pill status-pill--success">
                  <FileCheck2 size={14} /> {proofStatus === "PENDING_REVIEW" ? "COMPROBANTE RECIBIDO" : proofStatus || "COMPROBANTE"}
                </span>
              ) : (
                <span className="status-pill">Esperando comprobante</span>
              )}
            </div>
            <strong>{String(row.Total || "-")}</strong>
            <small>{String(row.Productos || "Sin detalle")}</small>
            <div>
              {proofMediaId ? (
                <a
                  className="btn btn--ghost"
                  href={`/api/admin/whatsapp/media/${encodeURIComponent(proofMediaId)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <FileCheck2 size={17} /> Ver comprobante
                </a>
              ) : null}
              {exactLocationHref ? (
                <a className="btn btn--ghost" href={exactLocationHref} target="_blank" rel="noreferrer">
                  <MapPinned size={17} /> Ubicación exacta
                </a>
              ) : null}
              <button
                className="btn"
                type="button"
                disabled={Boolean(busy)}
                onClick={() => void confirmPayment(String(row.Id))}
              >
                {busy === String(row.Id) ? <Landmark size={17} /> : <CheckCircle2 size={17} />}
                {busy === String(row.Id) ? "Confirmando..." : "Aceptar pago"}
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
        );
      })}
      {message ? <p className="notice notice--success" role="status">{message}</p> : null}
    </section>
  );
}
