"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Download, ExternalLink, RefreshCw, RotateCw, ShieldCheck } from "lucide-react";
import { currency } from "@/lib/formatters/currency";
import type { SupplierAuditStatus } from "@/lib/supplier-pricing/rules";

type AuditRow = {
  productId: string;
  productName: string;
  sku: string;
  supplierName: string | null;
  sourceUrl: string | null;
  originalPrice: number | null;
  currentMargin: number | null;
  expectedMargin: number | null;
  currentPrice: number;
  expectedPrice: number | null;
  difference: number | null;
  missingImage: boolean;
  missingDescription: boolean;
  availabilityStatus: string;
  status: SupplierAuditStatus;
};
type AuditResponse = {
  rows: AuditRow[];
  summary: {
    total: number; differences: number; wrongMargin: number; missingImage: number; missingDescription: number;
    missingSupplier: number; consult: number; missingSourceUrl: number; missingSourcePrice: number;
  };
};

const statusLabels: Record<SupplierAuditStatus, string> = {
  OK: "Correcto",
  PRICE_TOO_HIGH: "Precio mayor",
  PRICE_TOO_LOW: "Precio menor",
  MISSING_SOURCE_PRICE: "Sin precio origen",
  MISSING_SOURCE_URL: "Sin URL de fuente",
  MISSING_SUPPLIER: "Sin proveedor",
  MANUAL_REVIEW: "Revisión manual"
};

async function readResponse(response: Response) {
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof payload.message === "string" ? payload.message : "No pudimos completar la operación.");
  return payload;
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export function AdminSupplierPriceAudit() {
  const pathname = usePathname();
  const adminPath = pathname.replace(/\/auditoria-precios\/?$/, "");
  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState("");
  const [notice, setNotice] = useState("");
  const [supplier, setSupplier] = useState("ALL");
  const [status, setStatus] = useState("ISSUES");
  const [issue, setIssue] = useState("ALL");

  async function load() {
    setLoading(true);
    try {
      const result = await readResponse(await fetch("/api/admin/supplier-price-audit", { cache: "no-store" })) as unknown as AuditResponse;
      setData(result);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No pudimos cargar la auditoría.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    void fetch("/api/admin/supplier-price-audit", { cache: "no-store" })
      .then(readResponse)
      .then((result) => active && setData(result as unknown as AuditResponse))
      .catch((error: unknown) => active && setNotice(error instanceof Error ? error.message : "No pudimos cargar la auditoría."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const suppliers = useMemo(() => [...new Set((data?.rows ?? []).map((row) => row.supplierName).filter(Boolean))] as string[], [data]);
  const filtered = useMemo(() => (data?.rows ?? []).filter((row) => {
    if (supplier !== "ALL" && row.supplierName !== supplier) return false;
    if (status === "ISSUES" && row.status === "OK") return false;
    if (status !== "ALL" && status !== "ISSUES" && row.status !== status) return false;
    if (issue === "IMAGE" && !row.missingImage) return false;
    if (issue === "DESCRIPTION" && !row.missingDescription) return false;
    if (issue === "CONSULT" && row.availabilityStatus !== "CONSULT") return false;
    return true;
  }), [data, supplier, status, issue]);

  async function recalculate(row: AuditRow) {
    if (workingId) return;
    setWorkingId(row.productId);
    setNotice("");
    try {
      const result = await readResponse(await fetch("/api/admin/supplier-price-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: row.productId, expectedCurrentPrice: row.currentPrice })
      }));
      setNotice(typeof result.message === "string" ? result.message : "Precio recalculado.");
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No pudimos recalcular el precio.");
    } finally {
      setWorkingId("");
    }
  }

  function exportCsv() {
    const columns = ["Producto", "SKU", "Proveedor", "Precio origen", "Margen actual", "Margen esperado", "Precio FZAC", "Precio esperado", "Diferencia", "Estado", "URL fuente"];
    const lines = filtered.map((row) => [row.productName, row.sku, row.supplierName, row.originalPrice, row.currentMargin, row.expectedMargin, row.currentPrice, row.expectedPrice, row.difference, row.status, row.sourceUrl].map(csvCell).join(","));
    const blob = new Blob([`\uFEFF${columns.map(csvCell).join(",")}\n${lines.join("\n")}\n`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `auditoria-precios-fzac-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="admin-supplier-audit">
      <section className="admin-market-prices__guardrail">
        <ShieldCheck size={24} />
        <div><strong>Información comercial privada</strong><p>Los precios de origen y márgenes solo se entregan a esta ruta administradora. El catálogo público recibe únicamente el precio FZAC.</p></div>
      </section>

      <div className="admin-market-prices__summary" aria-label="Resumen de auditoría">
        <span><strong>{data?.summary.total ?? 0}</strong> revisados</span>
        <span><strong>{data?.summary.differences ?? 0}</strong> diferencias</span>
        <span><strong>{data?.summary.wrongMargin ?? 0}</strong> margen a revisar</span>
        <span><strong>{data?.summary.missingImage ?? 0}</strong> sin imagen</span>
        <span><strong>{data?.summary.missingDescription ?? 0}</strong> sin descripción</span>
        <span><strong>{data?.summary.consult ?? 0}</strong> CONSULT</span>
      </div>

      <section className="admin-panel admin-supplier-audit__filters" aria-label="Filtros de auditoría">
        <label>Proveedor<select value={supplier} onChange={(event) => setSupplier(event.target.value)}><option value="ALL">Todos</option>{suppliers.map((name) => <option key={name}>{name}</option>)}</select></label>
        <label>Estado<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="ISSUES">Solo diferencias</option><option value="ALL">Todos</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Dato operativo<select value={issue} onChange={(event) => setIssue(event.target.value)}><option value="ALL">Todos</option><option value="IMAGE">Sin imagen</option><option value="DESCRIPTION">Sin descripción</option><option value="CONSULT">A consultar</option></select></label>
        <button className="btn btn--ghost" type="button" onClick={() => void load()} disabled={loading}><RefreshCw size={17} className={loading ? "is-spinning" : undefined} />Actualizar</button>
        <button className="btn btn--ghost" type="button" onClick={exportCsv} disabled={!filtered.length}><Download size={17} />Exportar CSV</button>
      </section>

      {notice ? <p className="notice" role="status">{notice}</p> : null}
      <section className="admin-panel admin-supplier-audit__table">
        <header><div><h2>Resultados</h2><p>{loading ? "Consultando fuentes privadas…" : `${filtered.length} filas según los filtros. Se muestran hasta 400 para mantener ágil el panel.`}</p></div></header>
        {!loading && !filtered.length ? <p className="admin-empty">No hay resultados pendientes con estos filtros.</p> : null}
        {filtered.length ? <div className="table-scroll"><table><thead><tr><th>Producto</th><th>Proveedor</th><th>Origen</th><th>Regla</th><th>FZAC</th><th>Esperado</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{filtered.slice(0, 400).map((row) => <tr key={row.productId}>
          <td><strong>{row.productName}</strong><small>{row.sku}</small></td>
          <td>{row.supplierName ?? "Sin proveedor"}<small>{row.availabilityStatus}</small></td>
          <td>{row.originalPrice === null ? "Sin dato" : currency(row.originalPrice)}</td>
          <td>{row.expectedMargin === null ? "Manual" : `${row.expectedMargin}%`}<small>actual {row.currentMargin ?? "—"}%</small></td>
          <td>{currency(row.currentPrice)}</td>
          <td>{row.expectedPrice === null ? "Manual" : currency(row.expectedPrice)}<small>{row.difference === null ? "" : `Dif. ${currency(row.difference)}`}</small></td>
          <td><span className={`status-pill status-pill--${row.status === "OK" ? "success" : "warning"}`}>{statusLabels[row.status]}</span>{row.missingImage ? <small>Sin imagen</small> : null}{row.missingDescription ? <small>Sin descripción</small> : null}</td>
          <td><div className="admin-supplier-audit__actions">{row.sourceUrl ? <a className="btn btn--ghost" href={row.sourceUrl} target="_blank" rel="noreferrer"><ExternalLink size={15} />Fuente</a> : null}<Link className="btn btn--ghost" href={`${adminPath}/productos`} >Editar</Link>{row.expectedPrice !== null && row.status !== "OK" ? <button className="btn btn--primary" type="button" disabled={Boolean(workingId)} onClick={() => void recalculate(row)}><RotateCw size={15} />{workingId === row.productId ? "Aplicando" : "Recalcular"}</button> : null}</div></td>
        </tr>)}</tbody></table></div> : null}
      </section>
    </div>
  );
}
