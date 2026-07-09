"use client";

import { useState } from "react";
import { CheckCircle2, MessageCircle, XCircle } from "lucide-react";
import { getWhatsAppHref } from "@/lib/utils/contact";

type OrderRow = Record<string, string | number | null | undefined>;

const columns = ["Referencia", "Cliente", "Email", "Telefono", "Productos", "Total", "Estado", "Pago", "Envio", "Fecha"];

export function AdminOrdersView({ rows }: { rows: OrderRow[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function updateOrder(id: string, action: "approve" | "reject") {
    if (busy) return;
    setBusy(`${action}-${id}`);
    setMessage("");

    const response = await fetch(`/api/admin/orders/${id}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: action === "reject" ? JSON.stringify({ reason: "Rechazada desde panel FZAC." }) : "{}"
    });
    const data = (await response.json().catch(() => ({}))) as { message?: string };
    setMessage(data.message || (response.ok ? "Orden actualizada." : "No pudimos actualizar la orden."));
    setBusy(null);
    if (response.ok) window.location.reload();
  }

  const approvalRows = rows.filter((row) => row.Estado === "Validacion admin");

  return (
    <>
      {approvalRows.length ? (
        <section className="admin-large-purchases">
          {approvalRows.map((row) => (
            <article className="admin-large-purchase-card" key={row.Id}>
              <div>
                <span className="kicker">Compra grande</span>
                <h2>{row.Cliente}</h2>
                <p>Supera el limite de aprobacion automatica. Revisar monto, stock y contacto antes de habilitar pago.</p>
              </div>
              <strong>{row.Total}</strong>
              <small>{row.Productos}</small>
              <div>
                <button className="btn" type="button" disabled={Boolean(busy)} onClick={() => updateOrder(String(row.Id), "approve")}>
                  <CheckCircle2 size={17} /> Aprobar compra
                </button>
                <button className="btn btn--ghost" type="button" disabled={Boolean(busy)} onClick={() => updateOrder(String(row.Id), "reject")}>
                  <XCircle size={17} /> Rechazar
                </button>
                <a className="btn btn--ghost" href={getWhatsAppHref(`Hola FZAC, quiero revisar la compra ${row.Referencia}.`)} target="_blank" rel="noreferrer">
                  <MessageCircle size={17} /> Contactar
                </a>
              </div>
            </article>
          ))}
        </section>
      ) : null}
      {message ? <p className="notice notice--success">{message}</p> : null}
      <section className="admin-panel">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((row) => (
                  <tr key={row.Id}>
                    {columns.map((column) => (
                      <td data-label={column} key={column}>
                        {column === "Estado" && row[column] === "Validacion admin" ? (
                          <span className="status-pill status-pill--warning">{row[column]}</span>
                        ) : (
                          (row[column] ?? "-")
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length}>No hay registros para mostrar.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
