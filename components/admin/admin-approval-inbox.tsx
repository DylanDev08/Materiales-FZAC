"use client";

import { useState } from "react";
import { CheckCircle2, MessageCircle, ShieldAlert, XCircle } from "lucide-react";
import { getWhatsAppHref } from "@/lib/utils/contact";

type ApprovalRow = Record<string, string | number | null | undefined>;

export function AdminApprovalInbox({ rows }: { rows: ApprovalRow[] }) {
  const approvalRows = rows.filter((row) => String(row.__statusRaw) === "PENDING_ADMIN_APPROVAL");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function updateOrder(id: string, action: "approve" | "reject") {
    if (busy) return;
    setBusy(`${action}-${id}`);
    setMessage("");

    const response = await fetch(`/api/admin/orders/${id}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: action === "reject" ? JSON.stringify({ reason: "Rechazada desde bandeja de aprobación FZAC." }) : "{}"
    });
    const data = (await response.json().catch(() => ({}))) as { message?: string };
    setBusy(null);
    setMessage(data.message || (response.ok ? "Compra actualizada." : "No pudimos actualizar la compra."));
    if (response.ok) window.location.reload();
  }

  if (!approvalRows.length) {
    return (
      <section className="admin-approval-inbox admin-approval-inbox--empty">
        <ShieldAlert size={19} />
        <div>
          <strong>Sin compras grandes esperando aprobación</strong>
          <small>Las compras que requieran revisión aparecerán acá antes de habilitar el pago.</small>
        </div>
      </section>
    );
  }

  return (
    <section className="admin-approval-inbox" aria-label="Compras grandes pendientes de aprobación">
      <header>
        <div>
          <span className="kicker">Requiere decisión</span>
          <h2>Compras grandes para aprobar</h2>
          <p>Revisá cliente, monto y productos. Podés aprobar, rechazar o contactar sin buscar el pedido en otra pantalla.</p>
        </div>
        <strong>{approvalRows.length}</strong>
      </header>

      <div className="admin-approval-inbox__list">
        {approvalRows.map((row) => (
          <article key={String(row.Id)}>
            <div className="admin-approval-inbox__main">
              <span>Compra prioritaria · {String(row.Referencia || "")}</span>
              <h3>{String(row.Cliente || "Cliente")}</h3>
              <p>{String(row.Productos || "Sin detalle de productos")}</p>
              <small>{String(row.Email || "")} · {String(row.Telefono || "sin teléfono")}</small>
            </div>
            <strong className="admin-approval-inbox__total">{String(row.Total || "-")}</strong>
            <div className="admin-approval-inbox__actions">
              <button className="btn" type="button" disabled={Boolean(busy)} onClick={() => void updateOrder(String(row.Id), "approve")}>
                <CheckCircle2 size={17} /> Aprobar compra
              </button>
              <button className="btn btn--ghost" type="button" disabled={Boolean(busy)} onClick={() => void updateOrder(String(row.Id), "reject")}>
                <XCircle size={17} /> Rechazar
              </button>
              <a className="btn btn--ghost" href={getWhatsAppHref(`Hola, te contactamos desde FZAC por la compra ${String(row.Referencia || "")}.`)} target="_blank" rel="noreferrer">
                <MessageCircle size={17} /> WhatsApp
              </a>
            </div>
          </article>
        ))}
      </div>

      {message ? <p className="notice" role="status">{message}</p> : null}
    </section>
  );
}
