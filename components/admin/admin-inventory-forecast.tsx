"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, PackageCheck, RefreshCw, Search, ShieldCheck, TrendingUp } from "lucide-react";
import type { InventoryForecastResult, InventoryForecastRow, InventoryForecastStatus } from "@/lib/inventory/forecast";

const statusLabels: Record<InventoryForecastStatus, string> = {
  OUT_OF_STOCK: "Sin stock",
  CRITICAL: "Cobertura crítica",
  REORDER: "Reponer",
  HEALTHY: "Cobertura saludable",
  NO_HISTORY: "Sin historial"
};

const statusFilters: Array<{ value: "ALL" | "URGENT" | InventoryForecastStatus; label: string }> = [
  { value: "ALL", label: "Todos" },
  { value: "URGENT", label: "Urgentes" },
  { value: "REORDER", label: "A reponer" },
  { value: "HEALTHY", label: "Saludables" },
  { value: "NO_HISTORY", label: "Sin historial" }
];

function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function statusTone(status: InventoryForecastStatus) {
  if (status === "OUT_OF_STOCK" || status === "CRITICAL") return "danger";
  if (status === "REORDER" || status === "NO_HISTORY") return "warning";
  return "success";
}

function confidenceLabel(value: InventoryForecastRow["confidence"]) {
  return value === "HIGH" ? "Alta" : value === "MEDIUM" ? "Media" : value === "LOW" ? "Baja" : "Sin historial";
}

function coverageLabel(row: InventoryForecastRow) {
  if (row.coverageDays === null) return "Sin cálculo";
  if (row.coverageDays <= 0) return "Agotado";
  return `${row.coverageDays.toFixed(1)} días`;
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function downloadCsv(rows: InventoryForecastRow[]) {
  const header = ["Producto", "SKU", "Categoría", "Stock", "Mínimo", "Vendidas", "Pendientes", "Demanda diaria", "Cobertura días", "Punto de reposición", "Compra sugerida", "Estado", "Confianza"];
  const body = rows.map((row) => [
    row.productName, row.sku, row.categoryName, row.stock, row.minimumStock, row.unitsSold, row.pendingUnits,
    row.averageDailyDemand, row.coverageDays ?? "", row.reorderPoint, row.suggestedOrder, statusLabels[row.status], confidenceLabel(row.confidence)
  ]);
  const content = [header, ...body].map((line) => line.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `fzac-reposicion-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function DemandChart({ data }: { data: InventoryForecastResult["dailyDemand"] }) {
  const width = 900;
  const height = 190;
  const maximum = Math.max(...data.map((point) => point.units), 1);
  const points = data.map((point, index) => {
    const x = data.length > 1 ? (index / (data.length - 1)) * width : width / 2;
    const y = height - 18 - (point.units / maximum) * (height - 36);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return <section className="admin-inventory-chart" aria-label="Unidades vendidas por día">
    <header><div><span className="kicker">Demanda confirmada</span><h2>Movimiento de unidades</h2></div><strong>Últimos {data.length} días</strong></header>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Evolución diaria de unidades vendidas">
      {[40, 80, 120, 160].map((y) => <line key={y} x1="0" x2={width} y1={y} y2={y} />)}
      <polyline points={points} />
      {data.map((point, index) => {
        const [x, y] = points.split(" ")[index].split(",");
        return <circle cx={x} cy={y} key={point.date} r="4"><title>{point.date}: {point.units} unidades</title></circle>;
      })}
    </svg>
    <div className="admin-inventory-chart__axis"><span>{data[0]?.date.slice(5) ?? "-"}</span><span>{data.at(-1)?.date.slice(5) ?? "-"}</span></div>
  </section>;
}

export function AdminInventoryForecast({ adminPath }: { adminPath: string }) {
  const [data, setData] = useState<InventoryForecastResult | null>(null);
  const [range, setRange] = useState<30 | 60 | 90>(30);
  const [filter, setFilter] = useState<(typeof statusFilters)[number]["value"]>("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    void fetch(`/api/admin/inventory/forecast?range=${range}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = await response.json().catch(() => ({})) as InventoryForecastResult & { message?: string };
        if (!response.ok) throw new Error(body.message || "No pudimos calcular la reposición.");
        return body;
      })
      .then((body) => active && setData(body))
      .catch((error: unknown) => {
        if (active && !(error instanceof DOMException && error.name === "AbortError")) {
          setMessage(error instanceof Error ? error.message : "No pudimos cargar el inventario.");
        }
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; controller.abort(); };
  }, [range, reloadKey]);

  function selectRange(days: 30 | 60 | 90) {
    if (days === range) return;
    setLoading(true);
    setMessage("");
    setRange(days);
  }

  function reload() {
    setLoading(true);
    setMessage("");
    setReloadKey((current) => current + 1);
  }

  const visibleRows = useMemo(() => {
    const query = normalized(search);
    return (data?.rows ?? []).filter((row) => {
      const matchesText = !query || normalized(`${row.productName} ${row.sku} ${row.categoryName}`).includes(query);
      const matchesStatus = filter === "ALL"
        || (filter === "URGENT" && (row.status === "OUT_OF_STOCK" || row.status === "CRITICAL"))
        || row.status === filter;
      return matchesText && matchesStatus;
    });
  }, [data?.rows, filter, search]);

  return <div className="admin-inventory">
    <section className="admin-inventory__guardrail">
      <ShieldCheck size={22} />
      <div><strong>Pronóstico supervisado</strong><p>Las sugerencias usan ventas con stock descontado. Los pedidos pendientes solo muestran riesgo y nunca reservan ni modifican unidades.</p></div>
    </section>

    <div className="admin-inventory__controls">
      <div role="tablist" aria-label="Período de análisis">
        {[30, 60, 90].map((days) => <button aria-selected={range === days} className={range === days ? "active" : ""} key={days} onClick={() => selectRange(days as 30 | 60 | 90)} role="tab" type="button">{days} días</button>)}
      </div>
      <button className="btn btn--ghost" disabled={loading} onClick={reload} type="button"><RefreshCw className={loading ? "is-spinning" : undefined} size={17} />Actualizar</button>
    </div>

    {message ? <p className="notice notice--danger" role="alert">{message}</p> : null}
    {loading && !data ? <section className="admin-inventory__skeleton" aria-label="Cargando pronóstico"><span /><span /><span /><span /></section> : null}

    {data ? <>
      <section className="admin-inventory__metrics" aria-label="Resumen de inventario">
        <span><strong>{data.overview.outOfStock}</strong> sin stock</span>
        <span><strong>{data.overview.critical}</strong> críticos</span>
        <span><strong>{data.overview.reorder}</strong> a reponer</span>
        <span><strong>{data.overview.pendingUnits}</strong> un. pendientes</span>
        <span><strong>{data.overview.unitsSold}</strong> un. vendidas</span>
        <span><strong>{data.overview.suggestedUnits}</strong> compra sugerida</span>
      </section>

      {data.truncated ? <p className="notice"><AlertTriangle size={17} />Hay más movimientos que el límite de lectura. Usá el período menor para una proyección completa.</p> : null}
      <DemandChart data={data.dailyDemand} />

      <section className="admin-inventory__workspace">
        <header><div><span className="kicker">Plan de reposición</span><h2>Productos y cobertura</h2><p>Ordenados por urgencia, demanda pendiente y días de cobertura.</p></div><button className="btn btn--ghost" disabled={!visibleRows.length} onClick={() => downloadCsv(visibleRows)} type="button"><Download size={17} />Exportar CSV</button></header>
        <div className="admin-inventory__toolbar">
          <label><Search size={17} /><span className="sr-only">Buscar producto</span><input onChange={(event) => setSearch(event.target.value)} placeholder="Buscar producto, SKU o categoría" type="search" value={search} /></label>
          <div role="tablist" aria-label="Filtrar por estado">{statusFilters.map((option) => <button aria-selected={filter === option.value} className={filter === option.value ? "active" : ""} key={option.value} onClick={() => setFilter(option.value)} role="tab" type="button">{option.label}</button>)}</div>
        </div>

        {!visibleRows.length ? <p className="admin-empty">No hay productos para este filtro.</p> : <div className="admin-inventory__list">
          {visibleRows.map((row) => <article className={`admin-inventory__row admin-inventory__row--${statusTone(row.status)}`} key={row.productId}>
            <div className="admin-inventory__product"><span>{row.status === "HEALTHY" ? <CheckCircle2 size={18} /> : row.status === "NO_HISTORY" ? <TrendingUp size={18} /> : <AlertTriangle size={18} />}</span><div><strong>{row.productName}</strong><small>{row.sku} · {row.categoryName}</small></div></div>
            <div className="admin-inventory__numbers">
              <span><small>Stock</small><strong>{row.stock} {row.unit}</strong></span>
              <span><small>Vendidas</small><strong>{row.unitsSold}</strong></span>
              <span><small>Pendientes</small><strong>{row.pendingUnits}</strong></span>
              <span><small>Cobertura</small><strong>{coverageLabel(row)}</strong></span>
              <span><small>Reponer</small><strong>{row.suggestedOrder || "-"}</strong></span>
            </div>
            <div className="admin-inventory__signal"><span className={`status-pill status-pill--${statusTone(row.status)}`}>{statusLabels[row.status]}</span><p>{row.reason}</p><small>Confianza {confidenceLabel(row.confidence)} · punto de reposición {row.reorderPoint}</small></div>
            <Link className="btn btn--ghost" href={`${adminPath}/productos?product=${encodeURIComponent(row.productId)}`}><PackageCheck size={17} />Editar stock</Link>
          </article>)}
        </div>}
      </section>

      <footer className="admin-inventory__policy">Política actual: {data.policy.leadTimeDays} días de reposición, {data.policy.safetyDays} de seguridad y objetivo de {data.policy.targetCoverageDays} días. Generado {new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(new Date(data.generatedAt))}.</footer>
    </> : null}
  </div>;
}
