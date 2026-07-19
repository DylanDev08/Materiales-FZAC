"use client";

import { FormEvent, useRef, useState } from "react";
import { Loader2, RotateCcw, X } from "lucide-react";
import { useRouter } from "next/navigation";

const refundReasons = [
  ["PURCHASE_REGRET", "Arrepentimiento de compra"],
  ["OUT_OF_STOCK", "Falta de stock"],
  ["ORDER_ERROR", "Error en el pedido"],
  ["NOT_DELIVERED", "Producto no entregado"],
  ["APPROVED_CLAIM", "Reclamo aprobado"],
  ["OTHER", "Otro"]
] as const;

export function AdminRefundAction({
  paymentId,
  provider,
  status,
  reference
}: {
  paymentId?: string;
  provider?: string;
  status?: string;
  reference?: string;
}) {
  const router = useRouter();
  const inFlightRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof refundReasons)[number][0]>("PURCHASE_REGRET");
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "warning" | "danger">("success");

  if (!paymentId || provider !== "MERCADOPAGO") return null;
  if (status === "REFUNDED") return <p className="notice notice--success">Este pago ya fue reembolsado.</p>;
  if (status !== "PAID") return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlightRef.current || completed || details.trim().length < 5) return;

    inFlightRef.current = true;
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(`/api/admin/payments/${paymentId}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, details: details.trim() })
      });
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; code?: string; message?: string };
      if (!response.ok || !data.ok) {
        const requiresReconciliation = data.code === "REFUND_RECONCILIATION_REQUIRED";
        setMessageTone(requiresReconciliation ? "warning" : "danger");
        if (requiresReconciliation) setCompleted(true);
        setMessage(data.message || "No pudimos procesar el reembolso.");
        return;
      }

      setCompleted(true);
      setMessageTone("success");
      setMessage(data.message || "Reembolso solicitado correctamente.");
      router.refresh();
    } catch {
      setMessageTone("danger");
      setMessage("No pudimos conectar con el servidor. El reembolso no fue repetido.");
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }

  return (
    <section className="admin-refund-action">
      <div>
        <span className="kicker">Politica del consumidor</span>
        <h3>Gestionar reembolso</h3>
        <p>Disponible solo para pagos aprobados de Mercado Pago. Se realiza una devolucion total.</p>
      </div>
      <button className="btn btn--ghost" type="button" onClick={() => setOpen(true)}>
        <RotateCcw size={17} /> Gestionar reembolso
      </button>

      {open ? (
        <div className="admin-modal-backdrop" role="presentation">
          <section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="refund-title">
            <header>
              <div>
                <span className="kicker">Pedido {reference || "FZAC"}</span>
                <h2 id="refund-title">Confirmar reembolso total</h2>
              </div>
              <button className="admin-icon-button" type="button" onClick={() => setOpen(false)} disabled={loading} aria-label="Cerrar">
                <X size={18} />
              </button>
            </header>

            <form onSubmit={submit}>
              <label className="field">
                Motivo
                <select value={reason} onChange={(event) => setReason(event.target.value as typeof reason)} disabled={loading}>
                  {refundReasons.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                </select>
              </label>
              <label className="field">
                Detalle obligatorio
                <textarea
                  value={details}
                  onChange={(event) => setDetails(event.target.value)}
                  minLength={5}
                  maxLength={300}
                  rows={4}
                  placeholder="Explica brevemente por que se aprueba la devolucion."
                  disabled={loading}
                  required
                />
              </label>
              <p className="admin-refund-warning">La accion devuelve el monto completo, cancela el comprobante y restituye el stock una sola vez.</p>
              {message ? <p className={`notice notice--${messageTone}`}>{message}</p> : null}
              <footer>
                <button className="btn btn--ghost" type="button" onClick={() => setOpen(false)} disabled={loading}>Cerrar</button>
                <button className="btn" type="submit" disabled={loading || completed || details.trim().length < 5}>
                  {loading ? <Loader2 className="is-spinning" size={17} /> : <RotateCcw size={17} />}
                  {loading ? "Procesando..." : completed ? "Reembolso registrado" : "Confirmar reembolso"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      ) : null}
    </section>
  );
}
