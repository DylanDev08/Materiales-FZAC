import Link from "next/link";
import { ExternalLink, FileText, Mail, PackageSearch, Phone, ShoppingBasket } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminSupplierDocuments } from "@/components/admin/admin-supplier-documents";
import { currency } from "@/lib/formatters/currency";
import { getSupplierWorkspace } from "@/lib/suppliers/workspace";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getAdminConsolePath } from "@/lib/utils/env";

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function initials(value: string) {
  return value.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

export default async function Page({
  searchParams
}: {
  searchParams: Promise<{ supplier?: string | string[]; q?: string | string[]; page?: string | string[] }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const supplierId = firstValue(params.supplier);
  const query = firstValue(params.q) ?? "";
  const page = Number(firstValue(params.page) ?? 1);
  const data = await getSupplierWorkspace({ supplierId, query, page });
  const adminPath = getAdminConsolePath();
  const selected = data.selectedSupplier;
  const pageCount = Math.max(1, Math.ceil(data.totalProducts / data.pageSize));

  return (
    <AdminShell title="Proveedores" description="Directorio, documentos privados, productos y relación entre costo y precio de venta.">
      <div className="admin-supplier-workspace">
        {!data.ready ? <p className="notice notice--danger">No pudimos cargar el directorio de proveedores.</p> : null}
        <nav className="admin-supplier-workspace__directory" aria-label="Directorio de proveedores">
          {data.suppliers.map((supplier) => (
            <Link className={supplier.id === selected?.id ? "is-active" : undefined} href={`${adminPath}/proveedores?supplier=${supplier.id}`} key={supplier.id}>
              <span className="admin-supplier-workspace__logo" style={supplier.logo_url ? { backgroundImage: `url("${supplier.logo_url}")` } : undefined}>{supplier.logo_url ? null : initials(supplier.name)}</span>
              <span><strong>{supplier.name}</strong><small>{supplier.productCount} productos · {supplier.documentCount} documentos</small></span>
            </Link>
          ))}
        </nav>

        {selected ? <>
          <section className="admin-supplier-workspace__profile">
            <div className="admin-supplier-workspace__profile-main">
              <span className="admin-supplier-workspace__logo admin-supplier-workspace__logo--large" style={selected.logo_url ? { backgroundImage: `url("${selected.logo_url}")` } : undefined}>{selected.logo_url ? null : initials(selected.name)}</span>
              <div><span className="kicker">{selected.code}</span><h2>{selected.name}</h2><p>{selected.notes || "Sin notas comerciales cargadas."}</p></div>
            </div>
            <div className="admin-supplier-workspace__contact">
              {selected.website_url ? <a href={selected.website_url} rel="noreferrer" target="_blank"><ExternalLink size={16} />Sitio web</a> : <span><ExternalLink size={16} />Web no cargada</span>}
              {selected.catalog_url ? <a href={selected.catalog_url} rel="noreferrer" target="_blank"><FileText size={16} />Catálogo público</a> : <span><FileText size={16} />Catálogo no cargado</span>}
              {selected.email ? <a href={`mailto:${selected.email}`}><Mail size={16} />{selected.email}</a> : <span><Mail size={16} />Email no cargado</span>}
              {selected.phone ? <a href={`tel:${selected.phone.replace(/[^+\d]/g, "")}`}><Phone size={16} />{selected.phone}</a> : <span><Phone size={16} />Teléfono no cargado</span>}
            </div>
            <div className="admin-supplier-workspace__profile-actions">
              <Link className="btn btn--ghost" href={`${adminPath}/compras`}><ShoppingBasket size={17} />Editar datos / comprar</Link>
              <Link className="btn btn--primary" href={`${adminPath}/reportes?supplier=${selected.id}&audience=internal`}><FileText size={17} />Crear PDF</Link>
            </div>
          </section>

          <AdminSupplierDocuments documents={data.documents} products={data.products} supplierId={selected.id} />

          <section className="admin-supplier-products">
            <header>
              <div><span className="kicker">Relación comercial</span><h2>Productos y márgenes</h2><p>El costo proveedor es privado. El stock externo no modifica el stock FZAC.</p></div>
              <form action={`${adminPath}/proveedores`} method="get">
                <input name="supplier" type="hidden" value={selected.id} />
                <label><span className="sr-only">Buscar producto del proveedor</span><input defaultValue={data.query} maxLength={80} name="q" placeholder="Buscar nombre o SKU" /></label>
                <button className="btn btn--ghost" type="submit"><PackageSearch size={17} />Buscar</button>
              </form>
            </header>
            {!data.products.length ? <p className="admin-empty">No hay productos vinculados para este filtro.</p> : (
              <div className="admin-supplier-products__table-wrap">
                <table>
                  <thead><tr><th>Producto</th><th>Estado</th><th>Stock FZAC</th><th>Costo proveedor</th><th>Precio cliente</th><th>Ganancia/u.</th><th>Markup</th></tr></thead>
                  <tbody>{data.products.map((product) => <tr key={product.productId}>
                    <td data-label="Producto"><strong>{product.name}</strong><small>{product.sku} · {product.unit}</small></td>
                    <td data-label="Estado"><span className={`status-pill ${product.active ? "status-pill--success" : "status-pill--muted"}`}>{product.active ? "Publicado" : "No publicado"}</span></td>
                    <td data-label="Stock FZAC">{product.stock} · {product.availabilityStatus === "CONSULT" ? "A consultar" : product.availabilityStatus}</td>
                    <td data-label="Costo proveedor">{currency(product.supplierPrice)}</td>
                    <td data-label="Precio cliente">{currency(product.customerPrice)}</td>
                    <td data-label="Ganancia/u.">{currency(product.grossProfit)}</td>
                    <td data-label="Markup">{new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(product.markupPercent)}%</td>
                  </tr>)}</tbody>
                </table>
              </div>
            )}
            <footer>
              <span>Página {data.page} de {pageCount} · {data.totalProducts} productos</span>
              <div>
                {data.page > 1 ? <Link className="btn btn--ghost" href={`${adminPath}/proveedores?supplier=${selected.id}&q=${encodeURIComponent(data.query)}&page=${data.page - 1}`}>Anterior</Link> : null}
                {data.page < pageCount ? <Link className="btn btn--ghost" href={`${adminPath}/proveedores?supplier=${selected.id}&q=${encodeURIComponent(data.query)}&page=${data.page + 1}`}>Siguiente</Link> : null}
              </div>
            </footer>
          </section>
        </> : <p className="admin-empty">Creá un proveedor desde Compras para comenzar.</p>}
      </div>
    </AdminShell>
  );
}
