"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ExternalLink, FilePlus2, Plus, Upload } from "lucide-react";
import { currency } from "@/lib/formatters/currency";
import type {
  SupplierDocument,
  SupplierWorkspaceProduct
} from "@/lib/suppliers/workspace";

const kindLabels: Record<string, string> = {
  PRICE_LIST: "Lista de precios",
  CATALOG: "Catálogo",
  QUOTE: "Cotización",
  INVOICE: "Factura",
  OTHER: "Otro"
};

function percentage(customerPrice: number | null, supplierPrice: number) {
  if (!customerPrice || supplierPrice <= 0) return "Sin comparación";
  return `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(((customerPrice - supplierPrice) / supplierPrice) * 100)}%`;
}

export function AdminSupplierDocuments({
  supplierId,
  documents,
  products
}: {
  supplierId: string;
  documents: SupplierDocument[];
  products: SupplierWorkspaceProduct[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const selectedProduct = useMemo(
    () => products.find((product) => product.productId === selectedProductId) ?? null,
    [products, selectedProductId]
  );

  async function uploadDocument(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const form = event.currentTarget;
    setSaving(true);
    setMessage("");
    try {
      const formData = new FormData(form);
      formData.set("supplierId", supplierId);
      const response = await fetch("/api/admin/supplier-documents", { method: "POST", body: formData });
      const body = await response.json() as { message?: string };
      if (!response.ok) throw new Error(body.message || "No pudimos cargar el documento.");
      form.reset();
      setMessage("Documento privado cargado y auditado correctamente.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No pudimos cargar el documento.");
    } finally {
      setSaving(false);
    }
  }

  async function addItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const formElement = event.currentTarget;
    setSaving(true);
    setMessage("");
    try {
      const form = new FormData(formElement);
      const response = await fetch("/api/admin/supplier-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ADD_ITEM",
          documentId: form.get("documentId"),
          productId: form.get("productId"),
          supplierProductName: form.get("supplierProductName"),
          supplierSku: form.get("supplierSku"),
          unit: form.get("unit"),
          supplierPrice: form.get("supplierPrice"),
          supplierStock: form.get("supplierStock")
        })
      });
      const body = await response.json() as { message?: string };
      if (!response.ok) throw new Error(body.message || "No pudimos agregar el renglón.");
      formElement.reset();
      setSelectedProductId("");
      setMessage("Precio proveedor comparado con el precio FZAC actual.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No pudimos agregar el renglón.");
    } finally {
      setSaving(false);
    }
  }

  async function openDocument(documentId: string) {
    setMessage("");
    try {
      const response = await fetch(`/api/admin/supplier-documents?id=${encodeURIComponent(documentId)}`, { cache: "no-store" });
      const body = await response.json() as { url?: string; message?: string };
      if (!response.ok || !body.url) throw new Error(body.message || "No pudimos abrir el documento.");
      window.open(body.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No pudimos abrir el documento.");
    }
  }

  const activeDocuments = documents.filter((document) => document.status === "ACTIVE");

  return (
    <section className="admin-supplier-documents">
      <header>
        <div><span className="kicker">Documentación privada</span><h2>Listas y PDFs del proveedor</h2></div>
        <span>{activeDocuments.length} activos</span>
      </header>

      {message ? <p className={message.includes("correctamente") || message.includes("comparado") ? "notice notice--success" : "notice notice--danger"} role="status">{message}</p> : null}

      <div className="admin-supplier-documents__forms">
        <form onSubmit={uploadDocument}>
          <div className="admin-supplier-documents__form-title"><Upload size={19} /><strong>Subir documento</strong></div>
          <label>Título<input maxLength={160} name="title" placeholder="Lista septiembre 2026" required /></label>
          <label>Tipo<select defaultValue="PRICE_LIST" name="kind"><option value="PRICE_LIST">Lista de precios</option><option value="CATALOG">Catálogo</option><option value="QUOTE">Cotización</option><option value="INVOICE">Factura</option><option value="OTHER">Otro</option></select></label>
          <label>Fecha del documento<input name="documentDate" type="date" /></label>
          <label>PDF, CSV o Excel<input accept="application/pdf,.pdf,text/csv,.csv,application/vnd.ms-excel,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx" name="file" required type="file" /></label>
          <label>Notas<textarea maxLength={600} name="notes" rows={2} /></label>
          <button className="btn btn--primary" disabled={saving} type="submit"><FilePlus2 size={17} />Guardar privado</button>
        </form>

        <form onSubmit={addItem}>
          <div className="admin-supplier-documents__form-title"><Plus size={19} /><strong>Comparar un precio</strong></div>
          <label>Documento<select name="documentId" required><option value="">Elegí un documento</option>{activeDocuments.map((document) => <option key={document.id} value={document.id}>{document.title}</option>)}</select></label>
          <label>Producto FZAC<select name="productId" onChange={(event) => setSelectedProductId(event.target.value)} value={selectedProductId}><option value="">Sin vincular / carga manual</option>{products.map((product) => <option key={product.productId} value={product.productId}>{product.name} · {product.sku}</option>)}</select></label>
          <label>Nombre en la lista<input defaultValue={selectedProduct?.name ?? ""} key={selectedProduct?.productId ?? "manual"} maxLength={180} name="supplierProductName" required /></label>
          <div className="admin-supplier-documents__inline">
            <label>SKU<input defaultValue={selectedProduct?.sku ?? ""} key={`sku-${selectedProduct?.productId ?? "manual"}`} maxLength={100} name="supplierSku" /></label>
            <label>Unidad<input defaultValue={selectedProduct?.unit ?? ""} key={`unit-${selectedProduct?.productId ?? "manual"}`} maxLength={40} name="unit" /></label>
          </div>
          <div className="admin-supplier-documents__inline">
            <label>Precio proveedor<input inputMode="decimal" min="0.01" name="supplierPrice" required step="0.01" type="number" /></label>
            <label>Stock proveedor (referencia)<input inputMode="decimal" min="0" name="supplierStock" step="0.001" type="number" /></label>
          </div>
          <small>El stock de esta lista no modifica el inventario vendible de FZAC.</small>
          <button className="btn btn--primary" disabled={saving} type="submit"><Plus size={17} />Agregar comparación</button>
        </form>
      </div>

      <div className="admin-supplier-documents__list">
        {!activeDocuments.length ? <p className="admin-empty">Todavía no hay documentos. El bucket es privado y cada acceso vence en 60 segundos.</p> : activeDocuments.map((document) => (
          <article key={document.id}>
            <header>
              <div><strong>{document.title}</strong><small>{kindLabels[document.kind] ?? document.kind} · {document.document_date ?? "Sin fecha"} · {(document.size_bytes / 1024).toFixed(0)} KB</small></div>
              <button className="btn btn--ghost" onClick={() => void openDocument(document.id)} type="button">Abrir <ExternalLink size={15} /></button>
            </header>
            {!document.items.length ? <p>Sin renglones verificados. El PDF queda archivado, pero no se inventan precios a partir del archivo.</p> : (
              <div className="admin-supplier-documents__table-wrap">
                <table>
                  <thead><tr><th>Producto</th><th>Proveedor</th><th>Precio FZAC al comparar</th><th>Diferencia</th><th>Markup</th><th>Stock proveedor</th></tr></thead>
                  <tbody>{document.items.map((item) => {
                    const customerPrice = item.customer_price_snapshot == null ? null : Number(item.customer_price_snapshot);
                    const supplierPrice = Number(item.supplier_price);
                    return <tr key={item.id}><td><strong>{item.supplier_product_name}</strong><small>{item.supplier_sku || "Sin SKU"}</small></td><td>{currency(supplierPrice)}</td><td>{customerPrice === null ? "Sin vínculo" : currency(customerPrice)}</td><td>{customerPrice === null ? "-" : currency(customerPrice - supplierPrice)}</td><td>{percentage(customerPrice, supplierPrice)}</td><td>{item.supplier_stock == null ? "No informado" : `${item.supplier_stock} (externo)`}</td></tr>;
                  })}</tbody>
                </table>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
