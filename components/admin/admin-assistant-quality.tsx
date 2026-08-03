"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle, BrainCircuit, CheckCircle2, Eye, MessageSquareWarning, RefreshCw, Save, XCircle } from "lucide-react";

type ReviewStatus = "OPEN" | "REVIEWING" | "RESOLVED" | "DISMISSED";
type ReviewReason = "NEGATIVE_FEEDBACK" | "LOW_CONFIDENCE" | "UNRESOLVED" | "HANDOFF";
type ReviewItem = {
  id: string;
  knowledge_slug: string | null;
  intent: string;
  reason: ReviewReason;
  confidence: number | string | null;
  priority: number;
  status: ReviewStatus;
  occurrence_count: number;
  review_notes: string | null;
  last_seen_at: string;
  user_message: { content: string; created_at: string } | null;
  assistant_message: { content: string; created_at: string } | null;
};
type QualityData = {
  items: ReviewItem[];
  metrics: { pending: number; reviewing: number; resolved: number; negative: number; urgent: number };
};

const emptyData: QualityData = { items: [], metrics: { pending: 0, reviewing: 0, resolved: 0, negative: 0, urgent: 0 } };
const reasonLabel: Record<ReviewReason, string> = {
  NEGATIVE_FEEDBACK: "El cliente indico que no ayudo",
  LOW_CONFIDENCE: "Clasificacion poco segura",
  UNRESOLVED: "No se resolvio en dos intentos",
  HANDOFF: "Requirio seguimiento"
};
const statusLabel: Record<ReviewStatus, string> = {
  OPEN: "Pendiente",
  REVIEWING: "En revision",
  RESOLVED: "Resuelta",
  DISMISSED: "Descartada"
};

async function readResponse(response: Response) {
  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof data.message === "string" ? data.message : "No pudimos completar la operacion.");
  return data;
}

function localDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export function AdminAssistantQuality() {
  const pathname = usePathname();
  const adminBase = pathname.replace(/\/calidad-ia\/?$/, "");
  const [data, setData] = useState<QualityData>(emptyData);
  const [filter, setFilter] = useState<ReviewStatus>("OPEN");
  const [selected, setSelected] = useState<ReviewItem | null>(null);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  async function load() {
    const response = await fetch("/api/admin/assistant-quality", { cache: "no-store" });
    const next = await readResponse(response) as unknown as QualityData;
    setData({ items: next.items ?? [], metrics: next.metrics ?? emptyData.metrics });
  }

  useEffect(() => {
    let active = true;
    void fetch("/api/admin/assistant-quality", { cache: "no-store" })
      .then(readResponse)
      .then((next) => active && setData(next as unknown as QualityData))
      .catch((error: unknown) => active && setNotice(error instanceof Error ? error.message : "No pudimos cargar la calidad del asistente."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selected) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [selected]);

  const filtered = useMemo(() => data.items.filter((item) => item.status === filter), [data.items, filter]);

  function openReview(item: ReviewItem) {
    setSelected(item);
    setNotes(item.review_notes ?? "");
    setNotice("");
  }

  async function update(status: ReviewStatus) {
    if (!selected || saving) return;
    setSaving(true);
    setNotice("");
    try {
      const response = await fetch("/api/admin/assistant-quality", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.id, status, notes })
      });
      await readResponse(response);
      await load();
      setSelected(null);
      setNotice(status === "RESOLVED" ? "Revision resuelta. El conocimiento no se publico automaticamente." : "Revision actualizada.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No pudimos actualizar la revision.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-ai-quality">
      <section className="admin-ai-quality__guardrail">
        <BrainCircuit size={24} />
        <div><strong>Aprendizaje supervisado</strong><p>Esta bandeja detecta respuestas dudosas. Ninguna observacion modifica ni publica respuestas sin revision humana.</p></div>
        <Link className="btn btn--ghost" href={`${adminBase}/conocimiento`}>Editar conocimiento</Link>
      </section>

      <div className="admin-ai-quality__metrics" aria-label="Resumen de calidad del asistente">
        <span><strong>{data.metrics.pending}</strong>Pendientes</span>
        <span><strong>{data.metrics.reviewing}</strong>En revision</span>
        <span><strong>{data.metrics.urgent}</strong>Prioridad alta</span>
        <span><strong>{data.metrics.negative}</strong>Votos negativos</span>
        <span><strong>{data.metrics.resolved}</strong>Resueltas</span>
      </div>

      <div className="admin-ai-quality__toolbar">
        <div role="tablist" aria-label="Estado de revisiones">
          {(Object.keys(statusLabel) as ReviewStatus[]).map((status) => (
            <button key={status} type="button" role="tab" aria-selected={filter === status} className={filter === status ? "active" : undefined} onClick={() => setFilter(status)}>
              {statusLabel[status]}
            </button>
          ))}
        </div>
        <button className="btn btn--ghost" type="button" disabled={loading} onClick={() => void load()}><RefreshCw size={16} />Actualizar</button>
      </div>

      {notice ? <p className="notice" role="status">{notice}</p> : null}
      {loading ? <div className="admin-panel admin-empty">Cargando revisiones...</div> : null}
      {!loading ? <section className="admin-ai-quality__list" aria-label="Conversaciones para revisar">
        {!filtered.length ? <div className="admin-panel admin-empty"><CheckCircle2 size={22} />No hay revisiones en este estado.</div> : filtered.map((item) => (
          <article key={item.id} className={`admin-ai-quality__row priority-${item.priority}`}>
            <div className="admin-ai-quality__signal">
              {item.priority >= 3 ? <AlertTriangle size={18} /> : <MessageSquareWarning size={18} />}
              <span><strong>{reasonLabel[item.reason]}</strong><small>{localDate(item.last_seen_at)} · {item.intent.replaceAll("_", " ")}</small></span>
            </div>
            <div className="admin-ai-quality__exchange">
              <p><span>Cliente</span>{item.user_message?.content ?? "Mensaje no disponible"}</p>
              <p><span>Asistente</span>{item.assistant_message?.content ?? "Respuesta no disponible"}</p>
            </div>
            <div className="admin-ai-quality__meta">
              <span>{item.confidence === null ? "Sin confianza" : `${Math.round(Number(item.confidence) * 100)}% confianza`}</span>
              {item.knowledge_slug ? <span>Conocimiento: {item.knowledge_slug}</span> : null}
              <button className="btn btn--ghost" type="button" onClick={() => openReview(item)}><Eye size={16} />Revisar</button>
            </div>
          </article>
        ))}
      </section> : null}

      {selected ? <div className="admin-ai-quality__backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}>
        <section className="admin-ai-quality__drawer" role="dialog" aria-modal="true" aria-labelledby="quality-review-title">
          <header><div><span className="kicker">Revision humana</span><h2 id="quality-review-title">{reasonLabel[selected.reason]}</h2></div><button type="button" aria-label="Cerrar revision" onClick={() => setSelected(null)}><XCircle size={22} /></button></header>
          <div className="admin-ai-quality__dialogue"><p><strong>Cliente</strong>{selected.user_message?.content}</p><p><strong>Asistente</strong>{selected.assistant_message?.content}</p></div>
          <label>Notas internas<textarea maxLength={800} rows={5} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Que debe corregirse o verificarse antes de actualizar Conocimiento IA" /></label>
          <p className="admin-ai-quality__warning">Resolver esta revision no entrena ni publica contenido automaticamente.</p>
          <div className="admin-ai-quality__actions">
            <button className="btn btn--ghost" type="button" disabled={saving} onClick={() => void update("DISMISSED")}><XCircle size={16} />Descartar</button>
            <button className="btn btn--ghost" type="button" disabled={saving} onClick={() => void update("REVIEWING")}><Eye size={16} />Dejar en revision</button>
            <button className="btn btn--primary" type="button" disabled={saving} onClick={() => void update("RESOLVED")}><Save size={16} />{saving ? "Guardando" : "Resolver"}</button>
          </div>
        </section>
      </div> : null}
    </div>
  );
}
