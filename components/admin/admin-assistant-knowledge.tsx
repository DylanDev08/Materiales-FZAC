"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { BookOpenCheck, Plus, Save, Search, ToggleLeft, ToggleRight } from "lucide-react";
import { slugify } from "@/lib/utils/slug";
import type { AssistantIntent } from "@/lib/assistant/contracts";

type KnowledgeRow = {
  id: string;
  slug: string;
  title: string;
  topic: string;
  intent: AssistantIntent;
  keywords: string[];
  phrases: string[];
  answer: string;
  alternate_answer: string | null;
  source_label: string;
  source_href: string;
  actions: Array<{ label: string; href?: string; message?: string }>;
  active: boolean;
  version: number;
  updated_at: string;
};

type KnowledgeMetrics = { total: number; active: number; positive: number; negative: number };
type KnowledgeResponse = { entries?: KnowledgeRow[]; metrics?: KnowledgeMetrics; message?: string };

type KnowledgeForm = Omit<KnowledgeRow, "version" | "updated_at">;

const emptyForm: KnowledgeForm = {
  id: "",
  slug: "",
  title: "",
  topic: "Compra",
  intent: "store_policy",
  keywords: [],
  phrases: [],
  answer: "",
  alternate_answer: null,
  source_label: "",
  source_href: "/",
  actions: [],
  active: true
};

const intentLabels: Array<{ value: AssistantIntent; label: string }> = [
  { value: "store_policy", label: "Políticas y compra" },
  { value: "payment", label: "Pagos" },
  { value: "delivery", label: "Entrega o retiro" },
  { value: "returns", label: "Cambios y devoluciones" },
  { value: "product_search", label: "Productos" },
  { value: "stock", label: "Stock" },
  { value: "price", label: "Precios" },
  { value: "estimate", label: "Cálculos" },
  { value: "order_status", label: "Pedidos" },
  { value: "human", label: "Atención humana" },
  { value: "greeting", label: "Saludo" },
  { value: "fallback", label: "Consulta general" }
];

async function fetchKnowledge() {
  const response = await fetch("/api/admin/assistant-knowledge", { cache: "no-store" });
  const data = (await response.json()) as KnowledgeResponse;
  if (!response.ok) throw new Error(data.message || "No pudimos cargar las respuestas.");
  return data;
}

function words(value: string) {
  return value.split(/[,\n]/).map((item) => item.trim()).filter(Boolean);
}

export function AdminAssistantKnowledge() {
  const [rows, setRows] = useState<KnowledgeRow[]>([]);
  const [metrics, setMetrics] = useState<KnowledgeMetrics>({ total: 0, active: 0, positive: 0, negative: 0 });
  const [form, setForm] = useState<KnowledgeForm>(emptyForm);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    try {
      const data = await fetchKnowledge();
      setRows(data.entries ?? []);
      setMetrics(data.metrics ?? { total: 0, active: 0, positive: 0, negative: 0 });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No pudimos cargar las respuestas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    void fetchKnowledge()
      .then((data) => {
        if (!active) return;
        setRows(data.entries ?? []);
        setMetrics(data.metrics ?? { total: 0, active: 0, positive: 0, negative: 0 });
      })
      .catch((error: unknown) => {
        if (active) setMessage(error instanceof Error ? error.message : "No pudimos cargar las respuestas.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const visibleRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return rows;
    return rows.filter((row) => [row.title, row.topic, row.slug].join(" ").toLowerCase().includes(normalized));
  }, [query, rows]);

  function edit(row: KnowledgeRow) {
    setForm({
      id: row.id,
      slug: row.slug,
      title: row.title,
      topic: row.topic,
      intent: row.intent,
      keywords: row.keywords ?? [],
      phrases: row.phrases ?? [],
      answer: row.answer,
      alternate_answer: row.alternate_answer,
      source_label: row.source_label,
      source_href: row.source_href,
      actions: row.actions ?? [],
      active: row.active
    });
    setMessage("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setMessage("");
    const actions = form.actions.length
      ? form.actions
      : [{ label: form.source_label || "Ver información", href: form.source_href }];
    try {
      const response = await fetch("/api/admin/assistant-knowledge", {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, id: form.id || undefined, actions })
      });
      const data = (await response.json()) as { entry?: KnowledgeRow; message?: string };
      if (!response.ok || !data.entry) throw new Error(data.message || "No pudimos guardar la respuesta.");
      setRows((current) => {
        const exists = current.some((row) => row.id === data.entry?.id);
        return exists ? current.map((row) => row.id === data.entry?.id ? data.entry! : row) : [data.entry!, ...current];
      });
      setForm(emptyForm);
      setMessage("Respuesta guardada. El asistente la incorporará en menos de 30 segundos.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No pudimos guardar la respuesta.");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(row: KnowledgeRow) {
    setMessage("");
    const response = await fetch("/api/admin/assistant-knowledge", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...row, active: !row.active })
    });
    const data = (await response.json()) as { entry?: KnowledgeRow; message?: string };
    if (!response.ok || !data.entry) {
      setMessage(data.message || "No pudimos cambiar el estado.");
      return;
    }
    setRows((current) => current.map((item) => item.id === row.id ? data.entry! : item));
    setMessage(data.entry.active ? "Respuesta publicada." : "Respuesta pausada.");
  }

  return (
    <div className="admin-knowledge">
      <header className="admin-section-heading">
        <div>
          <span className="kicker">Asistente FZAC</span>
          <h1>Base de conocimiento</h1>
          <p>Editá respuestas verificadas sin tocar código. Los cambios quedan versionados y visibles solo cuando están publicados.</p>
        </div>
        <button className="btn btn--ghost" type="button" onClick={() => setForm(emptyForm)}><Plus size={17} /> Nueva respuesta</button>
      </header>

      <section className="admin-knowledge__metrics" aria-label="Resumen del asistente">
        <span><strong>{metrics.active}</strong> publicadas</span>
        <span><strong>{metrics.total - metrics.active}</strong> pausadas</span>
        <span><strong>{metrics.positive}</strong> útiles</span>
        <span><strong>{metrics.negative}</strong> por mejorar</span>
      </section>

      {message ? <p className="notice" role="status">{message}</p> : null}

      <div className="admin-knowledge__layout">
        <section className="admin-panel admin-knowledge__list">
          <label className="admin-knowledge__search">
            <Search size={17} />
            <input aria-label="Buscar respuesta" placeholder="Buscar por tema o nombre" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          {loading ? <p className="admin-empty">Cargando respuestas...</p> : null}
          {!loading && !visibleRows.length ? <p className="admin-empty">No hay respuestas para mostrar.</p> : null}
          {visibleRows.map((row) => (
            <article className={`admin-knowledge-row ${form.id === row.id ? "is-selected" : ""}`} key={row.id}>
              <button type="button" onClick={() => edit(row)}>
                <span><BookOpenCheck size={17} /> {row.topic}</span>
                <strong>{row.title}</strong>
                <small>Versión {row.version} · {row.active ? "Publicada" : "Pausada"}</small>
              </button>
              <button className="admin-knowledge-row__toggle" type="button" onClick={() => void toggle(row)} aria-label={row.active ? `Pausar ${row.title}` : `Publicar ${row.title}`}>
                {row.active ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
              </button>
            </article>
          ))}
        </section>

        <section className="admin-panel admin-knowledge__editor">
          <div>
            <span className="kicker">{form.id ? "Editar" : "Crear"}</span>
            <h2>{form.id ? form.title : "Nueva respuesta"}</h2>
          </div>
          <form className="form-grid" onSubmit={save}>
            <label>Título<input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value, slug: form.id ? form.slug : slugify(event.target.value), source_label: form.source_label || event.target.value })} /></label>
            <label>Identificador<input required value={form.slug} onChange={(event) => setForm({ ...form, slug: slugify(event.target.value) })} /></label>
            <label>Tema<input required value={form.topic} onChange={(event) => setForm({ ...form, topic: event.target.value })} /></label>
            <label>Tipo de consulta<select value={form.intent} onChange={(event) => setForm({ ...form, intent: event.target.value as AssistantIntent })}>{intentLabels.map((intent) => <option key={intent.value} value={intent.value}>{intent.label}</option>)}</select></label>
            <label className="form-grid__wide">Palabras clave<input value={form.keywords.join(", ")} onChange={(event) => setForm({ ...form, keywords: words(event.target.value) })} placeholder="pago, tarjeta, seguridad" /></label>
            <label className="form-grid__wide">Preguntas frecuentes<input value={form.phrases.join(", ")} onChange={(event) => setForm({ ...form, phrases: words(event.target.value) })} placeholder="cómo puedo pagar, guardan mi tarjeta" /></label>
            <label className="form-grid__wide">Respuesta principal<textarea required minLength={20} maxLength={1200} rows={6} value={form.answer} onChange={(event) => setForm({ ...form, answer: event.target.value })} /></label>
            <label className="form-grid__wide">Respuesta alternativa<textarea minLength={20} maxLength={1200} rows={4} value={form.alternate_answer ?? ""} onChange={(event) => setForm({ ...form, alternate_answer: event.target.value || null })} /></label>
            <label>Nombre de la fuente<input required value={form.source_label} onChange={(event) => setForm({ ...form, source_label: event.target.value })} /></label>
            <label>Ruta interna<input required value={form.source_href} onChange={(event) => setForm({ ...form, source_href: event.target.value })} placeholder="/terminos" /></label>
            <label className="admin-checkbox form-grid__wide"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> Publicar esta respuesta</label>
            <div className="admin-knowledge__actions form-grid__wide">
              <button className="btn" disabled={saving} type="submit"><Save size={17} /> {saving ? "Guardando..." : "Guardar respuesta"}</button>
              {form.id ? <button className="btn btn--ghost" type="button" onClick={() => setForm(emptyForm)}>Cancelar edición</button> : null}
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
