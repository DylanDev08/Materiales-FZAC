"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { DatabaseZap, RefreshCw, Save, ShieldCheck, TrendingUp } from "lucide-react";
import { currency } from "@/lib/formatters/currency";

type Source = {
  id: string;
  slug: string;
  name: string;
  source_type: "MANUAL" | "API_JSON";
  base_url: string | null;
  feed_url: string | null;
  active: boolean;
  trusted: boolean;
};

type ProductOption = { id: string; name: string; sku: string; unit: string; price: number | string };
type Observation = {
  id: string;
  external_name: string;
  observed_price: number | string;
  normalized_price: number | string;
  sale_unit: string;
  observed_at: string;
  expires_at: string;
  source?: { name?: string; trusted?: boolean } | null;
  product?: { name?: string; sku?: string; unit?: string; price?: number | string } | null;
};
type SyncRun = {
  id: string;
  status: string;
  imported_count: number;
  rejected_count: number;
  started_at: string;
  source?: { name?: string } | null;
};
type AdminData = { sources: Source[]; observations: Observation[]; runs: SyncRun[]; products: ProductOption[] };

const emptyData: AdminData = { sources: [], observations: [], runs: [], products: [] };

async function readResponse(response: Response) {
  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof data.message === "string" ? data.message : "No pudimos completar la operacion.");
  return data;
}

function localDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export function AdminMarketPrices() {
  const [data, setData] = useState<AdminData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState("");
  const [sourceForm, setSourceForm] = useState({ id: "", name: "", slug: "", sourceType: "MANUAL" as Source["source_type"], baseUrl: "", feedUrl: "", active: true, trusted: false });
  const [observationForm, setObservationForm] = useState({ productId: "", sourceId: "", externalName: "", observedPrice: "", saleUnit: "", equivalentQuantity: "1", sourceUrl: "" });

  async function load() {
    const response = await fetch("/api/admin/market-prices", { cache: "no-store" });
    const next = await readResponse(response) as unknown as AdminData;
    setData({
      sources: next.sources ?? [],
      observations: next.observations ?? [],
      runs: next.runs ?? [],
      products: next.products ?? []
    });
  }

  useEffect(() => {
    let active = true;
    void fetch("/api/admin/market-prices", { cache: "no-store" })
      .then(readResponse)
      .then((next) => {
        if (!active) return;
        const result = next as unknown as AdminData;
        setData({ sources: result.sources ?? [], observations: result.observations ?? [], runs: result.runs ?? [], products: result.products ?? [] });
      })
      .catch((error: unknown) => active && setNotice(error instanceof Error ? error.message : "No pudimos cargar las referencias."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const trustedCount = useMemo(() => data.sources.filter((source) => source.active && source.trusted).length, [data.sources]);

  async function saveSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setNotice("");
    try {
      const response = await fetch("/api/admin/market-prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SOURCE",
          ...sourceForm,
          baseUrl: sourceForm.baseUrl || null,
          feedUrl: sourceForm.sourceType === "API_JSON" ? sourceForm.feedUrl || null : null,
          id: sourceForm.id || undefined,
          notes: null
        })
      });
      await readResponse(response);
      setSourceForm({ id: "", name: "", slug: "", sourceType: "MANUAL", baseUrl: "", feedUrl: "", active: true, trusted: false });
      setNotice("Fuente guardada. Marcala como confiable solo si FZAC verifico su origen y unidad de venta.");
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No pudimos guardar la fuente.");
    } finally {
      setSaving(false);
    }
  }

  async function saveObservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setNotice("");
    try {
      const response = await fetch("/api/admin/market-prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "OBSERVATION",
          ...observationForm,
          externalKey: `${observationForm.productId}-${Date.now()}`,
          sourceUrl: observationForm.sourceUrl || null
        })
      });
      await readResponse(response);
      setObservationForm({ productId: "", sourceId: "", externalName: "", observedPrice: "", saleUnit: "", equivalentQuantity: "1", sourceUrl: "" });
      setNotice("Referencia registrada. El asistente solo la usara cuando existan dos fuentes confiables y comparables.");
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No pudimos guardar la referencia.");
    } finally {
      setSaving(false);
    }
  }

  async function syncFeeds() {
    if (syncing) return;
    setSyncing(true);
    setNotice("");
    try {
      const response = await fetch("/api/admin/market-prices/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}"
      });
      const result = await readResponse(response) as { summary?: { imported?: number; rejected?: number } };
      setNotice(`Lectura terminada: ${result.summary?.imported ?? 0} referencias importadas y ${result.summary?.rejected ?? 0} rechazadas.`);
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No pudimos sincronizar las fuentes.");
    } finally {
      setSyncing(false);
    }
  }

  function editSource(source: Source) {
    setSourceForm({
      id: source.id,
      name: source.name,
      slug: source.slug,
      sourceType: source.source_type,
      baseUrl: source.base_url ?? "",
      feedUrl: source.feed_url ?? "",
      active: source.active,
      trusted: source.trusted
    });
    setNotice("Editando fuente. Guardala para aplicar los cambios.");
  }

  return (
    <div className="admin-market-prices">
      <section className="admin-market-prices__guardrail">
        <ShieldCheck size={24} />
        <div><strong>Referencia privada, no precio automatico</strong><p>Este modulo compara valores por unidad, fuente y vigencia. Nunca cambia el precio publicado ni autoriza una compra.</p></div>
      </section>

      <div className="admin-market-prices__summary" aria-label="Resumen de inteligencia de precios">
        <span><strong>{data.sources.length}</strong> fuentes</span>
        <span><strong>{trustedCount}</strong> confiables activas</span>
        <span><strong>{data.observations.length}</strong> observaciones recientes</span>
        <button className="btn btn--ghost" type="button" onClick={() => void syncFeeds()} disabled={syncing}>
          <RefreshCw size={17} className={syncing ? "is-spinning" : undefined} /> {syncing ? "Leyendo fuentes" : "Sincronizar"}
        </button>
      </div>

      {notice ? <p className="notice" role="status">{notice}</p> : null}
      {loading ? <div className="admin-panel admin-empty">Cargando inteligencia de precios...</div> : null}

      {!loading ? <div className="admin-market-prices__forms">
        <section className="admin-panel">
          <header><DatabaseZap size={20} /><div><h2>Fuente</h2><p>Alta manual o feed JSON expresamente autorizado.</p></div></header>
          <div className="admin-market-prices__source-list">
            {data.sources.map((source) => <button type="button" key={source.id} onClick={() => editSource(source)}><span><strong>{source.name}</strong><small>{source.source_type === "API_JSON" ? "Feed automatico" : "Carga manual"}</small></span><span>{source.active ? "Activa" : "Pausada"} · {source.trusted ? "Verificada" : "Sin verificar"}</span></button>)}
            {!data.sources.length ? <p className="admin-empty">No hay fuentes configuradas.</p> : null}
          </div>
          <form className="form-grid" onSubmit={saveSource}>
            <label>Nombre<input required minLength={2} maxLength={120} value={sourceForm.name} onChange={(event) => setSourceForm({ ...sourceForm, name: event.target.value })} /></label>
            <label>Identificador<input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={sourceForm.slug} onChange={(event) => setSourceForm({ ...sourceForm, slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} /></label>
            <label>Tipo<select value={sourceForm.sourceType} onChange={(event) => setSourceForm({ ...sourceForm, sourceType: event.target.value as Source["source_type"] })}><option value="MANUAL">Carga manual</option><option value="API_JSON">Feed JSON</option></select></label>
            <label>Web publica<input type="url" placeholder="https://" value={sourceForm.baseUrl} onChange={(event) => setSourceForm({ ...sourceForm, baseUrl: event.target.value })} /></label>
            {sourceForm.sourceType === "API_JSON" ? <label className="form-grid__wide">URL del feed<input required type="url" placeholder="https://" value={sourceForm.feedUrl} onChange={(event) => setSourceForm({ ...sourceForm, feedUrl: event.target.value })} /></label> : null}
            <label className="admin-market-prices__check form-grid__wide"><input type="checkbox" checked={sourceForm.active} onChange={(event) => setSourceForm({ ...sourceForm, active: event.target.checked })} /><span>Fuente activa</span></label>
            <label className="admin-market-prices__check form-grid__wide"><input type="checkbox" checked={sourceForm.trusted} onChange={(event) => setSourceForm({ ...sourceForm, trusted: event.target.checked })} /><span>Fuente verificada por FZAC</span></label>
            <button className="btn btn--primary form-grid__wide" disabled={saving} type="submit"><Save size={17} /> {sourceForm.id ? "Actualizar fuente" : "Guardar fuente"}</button>
          </form>
        </section>

        <section className="admin-panel">
          <header><TrendingUp size={20} /><div><h2>Nueva referencia</h2><p>Comparala con la misma presentacion y unidad de venta.</p></div></header>
          <form className="form-grid" onSubmit={saveObservation}>
            <label className="form-grid__wide">Producto FZAC<select required value={observationForm.productId} onChange={(event) => { const product = data.products.find((item) => item.id === event.target.value); setObservationForm({ ...observationForm, productId: event.target.value, saleUnit: product?.unit ?? observationForm.saleUnit }); }}><option value="">Seleccionar</option>{data.products.map((product) => <option key={product.id} value={product.id}>{product.name} - {product.sku}</option>)}</select></label>
            <label>Fuente<select required value={observationForm.sourceId} onChange={(event) => setObservationForm({ ...observationForm, sourceId: event.target.value })}><option value="">Seleccionar</option>{data.sources.filter((source) => source.active).map((source) => <option key={source.id} value={source.id}>{source.name}{source.trusted ? " - verificada" : ""}</option>)}</select></label>
            <label>Producto observado<input required minLength={2} maxLength={240} value={observationForm.externalName} onChange={(event) => setObservationForm({ ...observationForm, externalName: event.target.value })} /></label>
            <label>Precio observado<input required inputMode="decimal" value={observationForm.observedPrice} onChange={(event) => setObservationForm({ ...observationForm, observedPrice: event.target.value.replace(/[^0-9.,]/g, "").replace(",", ".") })} /></label>
            <label>Unidad comparable<input required maxLength={40} value={observationForm.saleUnit} onChange={(event) => setObservationForm({ ...observationForm, saleUnit: event.target.value })} /></label>
            <label>Cantidad equivalente<input required inputMode="decimal" value={observationForm.equivalentQuantity} onChange={(event) => setObservationForm({ ...observationForm, equivalentQuantity: event.target.value.replace(/[^0-9.,]/g, "").replace(",", ".") })} /></label>
            <label className="form-grid__wide">Enlace de evidencia<input type="url" placeholder="https://" value={observationForm.sourceUrl} onChange={(event) => setObservationForm({ ...observationForm, sourceUrl: event.target.value })} /></label>
            <button className="btn btn--primary form-grid__wide" disabled={saving} type="submit"><Save size={17} /> Guardar referencia</button>
          </form>
        </section>
      </div> : null}

      {!loading ? <section className="admin-panel admin-market-prices__table">
        <header><div><h2>Lecturas recientes</h2><p>Solo las fuentes confiables, vigentes y comparables pueden llegar al asistente.</p></div></header>
        {!data.observations.length ? <p className="admin-empty">Todavia no hay referencias cargadas.</p> : <div className="table-scroll"><table><thead><tr><th>Producto FZAC</th><th>Fuente</th><th>Referencia</th><th>Valor normalizado</th><th>Precio FZAC</th><th>Vigencia</th></tr></thead><tbody>{data.observations.map((row) => <tr key={row.id}><td><strong>{row.product?.name ?? "Producto"}</strong><small>{row.product?.sku ?? ""}</small></td><td>{row.source?.name ?? "Fuente"}<small>{row.source?.trusted ? "Verificada" : "No verificada"}</small></td><td>{row.external_name}</td><td>{currency(Number(row.normalized_price))} / {row.sale_unit}</td><td>{currency(Number(row.product?.price ?? 0))}</td><td>{localDate(row.observed_at)}<small>vence {localDate(row.expires_at)}</small></td></tr>)}</tbody></table></div>}
      </section> : null}
    </div>
  );
}
