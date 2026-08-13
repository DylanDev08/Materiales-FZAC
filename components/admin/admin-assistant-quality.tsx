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
  analytics: {
    periodDays: number;
    summary: {
      responses: number;
      feedback: number;
      helpfulRate: number | null;
      averageConfidence: number | null;
      escalationRate: number | null;
      reviewResolutionRate: number | null;
      groundedRate: number | null;
      safetyEvents: number;
      languageModelRewriteRate: number | null;
    };
    trend: Array<{ date: string; responses: number; helpful: number; negative: number; signals: number }>;
    intents: Array<{ intent: string; responses: number; averageConfidence: number | null; signals: number }>;
    opportunities: Array<{ intent: string; reason: ReviewReason; knowledgeSlug: string | null; count: number; priority: number; lastSeen: string; example: string }>;
    questions: Array<{ question: string; count: number; priority: number; lastSeen: string }>;
    tools: Array<{ name: string; count: number }>;
  };
};

const emptyAnalytics: QualityData["analytics"] = {
  periodDays: 30,
  summary: {
    responses: 0,
    feedback: 0,
    helpfulRate: null,
    averageConfidence: null,
    escalationRate: null,
    reviewResolutionRate: null,
    groundedRate: null,
    safetyEvents: 0,
    languageModelRewriteRate: null
  },
  trend: [],
  intents: [],
  opportunities: [],
  questions: [],
  tools: []
};
const emptyData: QualityData = { items: [], metrics: { pending: 0, reviewing: 0, resolved: 0, negative: 0, urgent: 0 }, analytics: emptyAnalytics };
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
const intentLabel: Record<string, string> = {
  greeting: "Saludos",
  delivery: "Envios y retiro",
  payment: "Pagos",
  stock: "Stock",
  price: "Precios",
  estimate: "Calculo de materiales",
  order_status: "Estado de pedido",
  account: "Mi cuenta",
  returns: "Cambios y devoluciones",
  store_policy: "Politicas comerciales",
  human: "Atencion humana",
  product_search: "Busqueda de productos",
  fallback: "Consulta sin clasificar"
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
  const [range, setRange] = useState<"7" | "30" | "90">("30");
  const [selected, setSelected] = useState<ReviewItem | null>(null);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  async function load(selectedRange = range) {
    const response = await fetch(`/api/admin/assistant-quality?range=${selectedRange}`, { cache: "no-store" });
    const next = await readResponse(response) as unknown as QualityData;
    setData({ items: next.items ?? [], metrics: next.metrics ?? emptyData.metrics, analytics: next.analytics ?? emptyAnalytics });
  }

  useEffect(() => {
    let active = true;
    void fetch(`/api/admin/assistant-quality?range=${range}`, { cache: "no-store" })
      .then(readResponse)
      .then((next) => {
        if (!active) return;
        const result = next as unknown as QualityData;
        setData({ items: result.items ?? [], metrics: result.metrics ?? emptyData.metrics, analytics: result.analytics ?? emptyAnalytics });
      })
      .catch((error: unknown) => active && setNotice(error instanceof Error ? error.message : "No pudimos cargar la calidad del asistente."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [range]);

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
  const maxTrendResponses = Math.max(1, ...data.analytics.trend.map((item) => item.responses));

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

      <section className="admin-ai-evaluation" aria-labelledby="assistant-evaluation-title">
        <header className="admin-ai-evaluation__head">
          <div><span className="kicker">Evaluacion continua</span><h2 id="assistant-evaluation-title">Que entiende bien y que debemos mejorar</h2><p>Datos reales del asistente. Los porcentajes sin suficientes señales se muestran como sin datos.</p></div>
          <div className="admin-ai-evaluation__periods" role="group" aria-label="Periodo de evaluacion">
            {(["7", "30", "90"] as const).map((days) => <button type="button" key={days} className={range === days ? "active" : undefined} aria-pressed={range === days} onClick={() => { if (range !== days) setLoading(true); setRange(days); }}>{days} dias</button>)}
          </div>
        </header>

        <div className="admin-ai-evaluation__summary" aria-label="Indicadores del periodo">
          <span><strong>{data.analytics.summary.responses}</strong>Respuestas</span>
          <span><strong>{data.analytics.summary.helpfulRate === null ? "Sin datos" : `${data.analytics.summary.helpfulRate}%`}</strong>Respuestas utiles</span>
          <span><strong>{data.analytics.summary.averageConfidence === null ? "Sin datos" : `${data.analytics.summary.averageConfidence}%`}</strong>Confianza media</span>
          <span><strong>{data.analytics.summary.escalationRate === null ? "Sin datos" : `${data.analytics.summary.escalationRate}%`}</strong>Derivadas</span>
          <span><strong>{data.analytics.summary.reviewResolutionRate === null ? "Sin datos" : `${data.analytics.summary.reviewResolutionRate}%`}</strong>Casos resueltos</span>
          <span><strong>{data.analytics.summary.groundedRate === null ? "Sin datos" : `${data.analytics.summary.groundedRate}%`}</strong>Con fuente real</span>
          <span><strong>{data.analytics.summary.safetyEvents}</strong>Datos protegidos</span>
          <span><strong>{data.analytics.summary.languageModelRewriteRate === null ? "Sin datos" : `${data.analytics.summary.languageModelRewriteRate}%`}</strong>Redacción asistida</span>
        </div>
        {data.analytics.tools.length ? (
          <p className="admin-ai-evaluation__tools">
            <strong>Consultas fundamentadas:</strong>{" "}
            {data.analytics.tools.map((tool) => `${tool.name.replace("catalog.search", "catálogo").replace("catalog.recommend", "recomendaciones").replace("knowledge.retrieve", "conocimiento").replace("orders.latest", "pedidos propios")} (${tool.count})`).join(" · ")}
          </p>
        ) : null}

        <div className="admin-ai-evaluation__visuals">
          <section className="admin-ai-trend" aria-label={`Actividad de los ultimos ${data.analytics.periodDays} dias`}>
            <header><div><h3>Actividad diaria</h3><p>Respuestas y senales que requieren revision.</p></div><span>{data.analytics.summary.feedback} valoraciones</span></header>
            <div className="admin-ai-trend__plot">
              {data.analytics.trend.map((day, index) => (
                <div className="admin-ai-trend__day" key={day.date} title={`${day.date}: ${day.responses} respuestas, ${day.signals} senales`}>
                  <span className="admin-ai-trend__bar" style={{ height: `${Math.max(4, Math.round((day.responses / maxTrendResponses) * 100))}%` }}><i style={{ height: `${Math.min(100, day.responses ? Math.round((day.signals / day.responses) * 100) : 0)}%` }} /></span>
                  {(index === 0 || index === data.analytics.trend.length - 1 || (data.analytics.trend.length <= 7)) ? <small>{new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit" }).format(new Date(`${day.date}T12:00:00Z`))}</small> : null}
                </div>
              ))}
            </div>
            <div className="admin-ai-trend__legend"><span><i />Respuestas</span><span><i />Para revisar</span></div>
          </section>

          <section className="admin-ai-intents" aria-label="Rendimiento por tema">
            <header><h3>Temas mas consultados</h3><p>Volumen, confianza y alertas por intencion.</p></header>
            <div>{data.analytics.intents.length ? data.analytics.intents.map((item) => (
              <article key={item.intent}>
                <span><strong>{intentLabel[item.intent] ?? item.intent}</strong><small>{item.responses} respuestas · {item.signals} alertas</small></span>
                <span className="admin-ai-intents__score"><i style={{ width: `${item.averageConfidence ?? 0}%` }} /><b>{item.averageConfidence === null ? "-" : `${item.averageConfidence}%`}</b></span>
              </article>
            )) : <p className="admin-empty">Todavia no hay actividad suficiente en este periodo.</p>}</div>
          </section>
        </div>

        <section className="admin-ai-opportunities" aria-label="Oportunidades de mejora">
          <header><div><h3>Oportunidades de mejora</h3><p>Agrupadas por tema y motivo. Primero revisa las de prioridad alta.</p></div><strong>{data.analytics.opportunities.length} grupos</strong></header>
          <div>{data.analytics.opportunities.length ? data.analytics.opportunities.map((item) => (
            <article key={`${item.intent}-${item.reason}-${item.knowledgeSlug ?? "general"}`}>
              <span className={`admin-ai-opportunities__priority priority-${item.priority}`}>{item.priority >= 3 ? "Alta" : "Normal"}</span>
              <span><strong>{intentLabel[item.intent] ?? item.intent}</strong><small>{reasonLabel[item.reason]} · {item.count} caso{item.count === 1 ? "" : "s"}</small>{item.example ? <p>“{item.example}”</p> : null}</span>
              <button type="button" onClick={() => setFilter("OPEN")}>Ver pendientes</button>
            </article>
          )) : <p className="admin-empty">No hay oportunidades pendientes en este momento.</p>}</div>
        </section>
        {data.analytics.questions.length ? <section className="admin-ai-questions" aria-label="Preguntas que conviene cubrir">
          <div><h3>Preguntas que conviene cubrir</h3><p>El contenido sensible se oculta antes de agruparlas.</p></div>
          <div>{data.analytics.questions.map((item) => <span key={`${item.question}-${item.lastSeen}`}><strong>{item.count}</strong>{item.question}</span>)}</div>
        </section> : null}
      </section>

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
