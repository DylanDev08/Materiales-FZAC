"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ClipboardCheck, ExternalLink } from "lucide-react";

const statusOptions = [
  ["RECEIVED", "Recibida"],
  ["IN_REVIEW", "En revisión"],
  ["APPROVED", "Aprobada para gestión"],
  ["REJECTED", "Rechazada"],
  ["CLOSED", "Cerrada"]
] as const;

const resolvedStatuses = new Set(["APPROVED", "REJECTED", "CLOSED"]);

export function AdminConsumerRequestAction({
  requestId,
  requestNumber,
  status,
  details,
  resolutionNote,
  orderId
}: {
  requestId?: string;
  requestNumber?: string;
  status?: string;
  details?: string;
  resolutionNote?: string;
  orderId?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [nextStatus, setNextStatus] = useState(status || "RECEIVED");
  const [note, setNote] = useState(resolutionNote || "");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  if (!requestId) return null;
  const needsNote = resolvedStatuses.has(nextStatus);
  const canSubmit = !loading && (!needsNote || note.trim().length >= 10);

  async function updateStatus() {
    if (!canSubmit) return;
    setLoading(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch(`/api/admin/consumer-refund-requests/${encodeURIComponent(String(requestId))}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, resolutionNote: note })
      });
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; message?: string };
      if (!response.ok || !data.ok) throw new Error(data.message || "No pudimos actualizar la solicitud.");
      setMessage(data.message || "Solicitud actualizada.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos actualizar la solicitud.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="admin-consumer-action" aria-labelledby="consumer-action-title">
      <header>
        <ClipboardCheck size={18} />
        <div>
          <span className="kicker">Gestión del trámite</span>
          <h3 id="consumer-action-title">{requestNumber || "Solicitud de consumidor"}</h3>
        </div>
      </header>

      <div className="admin-consumer-action__claim">
        <span>Solicitud del cliente</span>
        <p>{details || "Sin comentario adicional."}</p>
      </div>

      <label>
        Estado
        <select value={nextStatus} onChange={(event) => setNextStatus(event.target.value)} disabled={loading}>
          {statusOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
        </select>
      </label>
      <label>
        Nota de gestión {needsNote ? "(obligatoria)" : "(opcional)"}
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={500}
          placeholder="Explicá qué se revisó y cuál es el próximo paso."
          disabled={loading}
        />
        <small>{note.length}/500 {needsNote && note.trim().length < 10 ? "· mínimo 10 caracteres para resolver" : ""}</small>
      </label>

      <div className="admin-consumer-action__buttons">
        <button className="btn" type="button" onClick={updateStatus} disabled={!canSubmit}>
          {loading ? "Guardando..." : "Guardar estado"}
        </button>
        {orderId ? (
          <a
            className="btn btn--ghost"
            href={`${pathname.replace(/\/arrepentimientos(?:\/.*)?$/, "")}/pagos?order=${encodeURIComponent(orderId)}`}
          >
            <ExternalLink size={16} /> Pedido vinculado
          </a>
        ) : null}
      </div>
      {message ? <p className="notice notice--success">{message}</p> : null}
      {error ? <p className="notice notice--danger">{error}</p> : null}
      <p className="admin-consumer-action__warning">
        Aprobar el trámite no devuelve dinero automáticamente. Si corresponde, procesá el reembolso desde Pagos después de validar el cobro.
      </p>
    </section>
  );
}
