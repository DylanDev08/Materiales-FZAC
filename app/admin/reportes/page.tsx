import Image from "next/image";
import { FileText, Filter } from "lucide-react";
import { CatalogReportActions } from "@/components/admin/catalog-report-actions";
import { getCatalogProfitabilityReport } from "@/lib/analytics/catalog-profitability-report";
import { currency } from "@/lib/formatters/currency";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getAdminConsolePath } from "@/lib/utils/env";

type Audience = "customer" | "internal";
type Availability = "all" | "available" | "consult";
type CatalogScope = "active" | "all";

function value(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function normalize(valueToNormalize: string) {
  return valueToNormalize.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function percent(valueToFormat: number | null) {
  return valueToFormat === null ? "-" : `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(valueToFormat)}%`;
}

function dateLabel(valueToFormat: string) {
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(valueToFormat));
}

export default async function Page({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const audience: Audience = value(params.audience) === "internal" ? "internal" : "customer";
  const availability: Availability = ["available", "consult"].includes(value(params.availability))
    ? value(params.availability) as Availability
    : "all";
  const supplierId = value(params.supplier);
  const catalogScope: CatalogScope = audience === "internal" && value(params.catalog) === "all" ? "all" : "active";
  const categorySlug = value(params.category);
  const search = value(params.q).slice(0, 80);
  const report = await getCatalogProfitabilityReport("month", "all");
  const adminPath = getAdminConsolePath();

  const suppliers = Array.from(new Map(report.rows.filter((row) => row.supplierId && row.supplierName)
    .map((row) => [row.supplierId as string, row.supplierName as string])).entries())
    .sort((left, right) => left[1].localeCompare(right[1], "es-AR"));
  const categories = Array.from(new Map(report.rows.filter((row) => row.categorySlug && row.categoryName)
    .map((row) => [row.categorySlug as string, row.categoryName as string])).entries())
    .sort((left, right) => left[1].localeCompare(right[1], "es-AR"));
  const normalizedSearch = normalize(search);
  const rows = report.rows.filter((row) => {
    if (catalogScope === "active" && !row.active) return false;
    if (supplierId && row.supplierId !== supplierId) return false;
    if (categorySlug && row.categorySlug !== categorySlug) return false;
    if (availability === "available" && !(row.stock > 0 && row.availabilityStatus === "IN_STOCK")) return false;
    if (availability === "consult" && row.availabilityStatus !== "CONSULT") return false;
    if (normalizedSearch && !normalize(`${row.name} ${row.sku} ${row.categoryName ?? ""}`).includes(normalizedSearch)) return false;
    return true;
  });
  const title = audience === "customer" ? "Lista de precios FZAC" : "Comparación proveedor y cliente";
  const availableCount = rows.filter((row) => row.stock > 0 && row.availabilityStatus === "IN_STOCK").length;
  const consultCount = rows.filter((row) => row.availabilityStatus === "CONSULT").length;

  return (
    <main className="catalog-report-page">
      <section className="catalog-report-builder no-print">
        <header>
          <div><span className="kicker">Centro de reportes</span><h1>Crear PDF de catálogo y rentabilidad</h1><p>Filtrá materiales y elegí si el documento es para clientes o de uso interno.</p></div>
          <CatalogReportActions backHref={adminPath} title={title} />
        </header>
        <form method="get">
          <label>Tipo de reporte<select defaultValue={audience} name="audience"><option value="customer">Cliente · precios y disponibilidad</option><option value="internal">Interno · costo, precio y ganancia</option></select></label>
          <label>Proveedor<select defaultValue={supplierId} name="supplier"><option value="">Todos</option>{suppliers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
          {audience === "internal" ? <label>Catálogo<select defaultValue={catalogScope} name="catalog"><option value="active">Solo publicados</option><option value="all">Todos · incluye importados/inactivos</option></select></label> : null}
          <label>Categoría<select defaultValue={categorySlug} name="category"><option value="">Todas</option>{categories.map(([slug, name]) => <option key={slug} value={slug}>{name}</option>)}</select></label>
          <label>Disponibilidad<select defaultValue={availability} name="availability"><option value="all">Todas</option><option value="available">Disponible con stock</option><option value="consult">A consultar</option></select></label>
          <label>Producto / SKU<input defaultValue={search} maxLength={80} name="q" placeholder="Ej. placa o PGC" /></label>
          <button className="btn btn--primary" type="submit"><Filter size={17} />Aplicar filtros</button>
        </form>
        <p><FileText size={16} />El PDF para clientes nunca incluye costo, proveedor ni margen. Usá “Imprimir / Guardar como PDF” en el diálogo del navegador.</p>
      </section>

      <section className={`catalog-pdf-report catalog-pdf-report--${audience}`}>
        <header>
          <div className="catalog-pdf-report__brand"><Image className="fzac-logo-circular" src="/logoFZAC.jpg" alt="FZAC" width={72} height={72} priority /><div><span>Materiales FZAC</span><h2>{title}</h2></div></div>
          <div><strong>Generado</strong><span>{dateLabel(report.generatedAt)}</span><small>{rows.length} productos</small></div>
        </header>

        <div className="catalog-pdf-report__summary">
          <span><strong>{rows.length}</strong>Materiales listados</span>
          <span><strong>{availableCount}</strong>Disponibles</span>
          <span><strong>{consultCount}</strong>A consultar</span>
          {audience === "internal" ? <span><strong>{rows.filter((row) => row.supplierPrice !== null).length}</strong>Con costo registrado</span> : null}
        </div>

        {!report.available ? <p className="notice notice--danger">No pudimos leer el catálogo para generar este reporte.</p> : !rows.length ? <p className="catalog-pdf-report__empty">No hay productos para los filtros elegidos.</p> : (
          <table>
            <thead><tr><th>Material</th><th>Categoría</th>{audience === "internal" ? <><th>Proveedor</th><th>Costo</th></> : null}<th>Precio FZAC</th><th>Unidad</th><th>Disponibilidad</th>{audience === "internal" ? <><th>Ganancia/u.</th><th>Markup</th></> : null}</tr></thead>
            <tbody>{rows.map((row) => <tr key={row.productId}>
              <td><strong>{row.name}</strong><small>{row.sku}</small></td>
              <td>{row.categoryName ?? "Sin categoría"}</td>
              {audience === "internal" ? <><td>{row.supplierName ?? "Sin proveedor"}</td><td>{row.supplierPrice === null ? "Sin costo" : currency(row.supplierPrice)}</td></> : null}
              <td>{currency(row.ecommercePrice)}</td>
              <td>{row.unit}</td>
              <td>{!row.active ? "No publicado" : row.availabilityStatus === "CONSULT" ? "Consultar disponibilidad" : row.stock > 0 ? `Disponible · ${row.stock}` : "Sin stock"}</td>
              {audience === "internal" ? <><td>{row.unitGrossProfit === null ? "-" : currency(row.unitGrossProfit)}</td><td>{percent(row.markupPercent)}</td></> : null}
            </tr>)}</tbody>
          </table>
        )}

        <footer>
          {audience === "customer" ? <p>Precios sujetos a confirmación al momento de la compra. Los productos marcados “Consultar disponibilidad” requieren validación antes de agregarlos al pedido.</p> : <p>Documento privado. La ganancia por unidad es precio FZAC menos costo registrado; no contempla impuestos, comisiones ni otros gastos.</p>}
        </footer>
      </section>
    </main>
  );
}
