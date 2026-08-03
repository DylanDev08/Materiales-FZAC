"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Building2,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  PackageCheck,
  Plus,
  RefreshCw,
  Send,
  ShoppingBasket,
  Truck,
  X
} from "lucide-react";
import { currency } from "@/lib/formatters/currency";
import type { ProcurementData, ProcurementOrder, ProcurementSupplier } from "@/lib/procurement/service";

type Tab = "ORDERS" | "CREATE" | "SUPPLIERS";
type OrderLine = { productId: string; quantity: string; unitCost: string };
type SupplierForm = {
  id?: string;
  code: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  taxId: string;
  paymentTerms: string;
  leadTimeDays: string;
  notes: string;
  active: boolean;
};

const emptySupplier: SupplierForm = {
  code: "",
  name: "",
  contactName: "",
  email: "",
  phone: "",
  taxId: "",
  paymentTerms: "",
  leadTimeDays: "7",
  notes: "",
  active: true
};

const statusLabels: Record<ProcurementOrder["status"], string> = {
  DRAFT: "Borrador",
  ORDERED: "Esperando recepción",
  PARTIALLY_RECEIVED: "Recepción parcial",
  RECEIVED: "Recibida",
  CANCELLED: "Cancelada"
};

function statusTone(status: ProcurementOrder["status"]) {
  if (status === "RECEIVED") return "success";
  if (status === "CANCELLED") return "danger";
  return "warning";
}

function supplierToForm(supplier: ProcurementSupplier): SupplierForm {
  return {
    id: supplier.id,
    code: supplier.code,
    name: supplier.name,
    contactName: supplier.contact_name ?? "",
    email: supplier.email ?? "",
    phone: supplier.phone ?? "",
    taxId: supplier.tax_id ?? "",
    paymentTerms: supplier.payment_terms ?? "",
    leadTimeDays: String(supplier.lead_time_days),
    notes: supplier.notes ?? "",
    active: supplier.active
  };
}

function localDate(value: string | null) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "short" }).format(new Date(`${value.slice(0, 10)}T12:00:00`));
}

export function AdminProcurement({ adminPath, initialProductId }: { adminPath: string; initialProductId?: string }) {
  const [data, setData] = useState<ProcurementData | null>(null);
  const [tab, setTab] = useState<Tab>(initialProductId ? "CREATE" : "ORDERS");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [supplier, setSupplier] = useState<SupplierForm>(emptySupplier);
  const [supplierId, setSupplierId] = useState("");
  const [expectedAt, setExpectedAt] = useState("");
  const [notes, setNotes] = useState("");
  const [orderLines, setOrderLines] = useState<OrderLine[]>([{ productId: initialProductId ?? "", quantity: "1", unitCost: "" }]);
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [receivingOrderId, setReceivingOrderId] = useState<string | null>(null);
  const [receiptQuantities, setReceiptQuantities] = useState<Record<string, string>>({});
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  async function load() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/procurement", { cache: "no-store" });
      const body = await response.json() as ProcurementData & { message?: string };
      if (!response.ok) throw new Error(body.message || "No pudimos cargar compras y proveedores.");
      setData(body);
      setSupplierId((current) => current || body.suppliers.find((item) => item.active)?.id || "");
      if (initialProductId && body.products.some((product) => product.id === initialProductId)) {
        setOrderLines((current) => current[0]?.productId ? current : [{ productId: initialProductId, quantity: "1", unitCost: "" }]);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No pudimos cargar el módulo.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    void fetch("/api/admin/procurement", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = await response.json() as ProcurementData & { message?: string };
        if (!response.ok) throw new Error(body.message || "No pudimos cargar compras y proveedores.");
        return body;
      })
      .then((body) => {
        if (!active) return;
        setData(body);
        setSupplierId(body.suppliers.find((item) => item.active)?.id || "");
        if (initialProductId && body.products.some((product) => product.id === initialProductId)) {
          setOrderLines([{ productId: initialProductId, quantity: "1", unitCost: "" }]);
        }
      })
      .catch((error: unknown) => {
        if (active && !(error instanceof DOMException && error.name === "AbortError")) {
          setMessage(error instanceof Error ? error.message : "No pudimos cargar el módulo.");
        }
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; controller.abort(); };
  }, [initialProductId]);

  const orderTotal = useMemo(() => orderLines.reduce((sum, line) => {
    const quantity = Number(line.quantity);
    const cost = Number(line.unitCost);
    return sum + (Number.isFinite(quantity) && Number.isFinite(cost) ? quantity * cost : 0);
  }, 0), [orderLines]);

  async function mutate(payload: Record<string, unknown>, method: "POST" | "PATCH") {
    if (saving) return null;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/procurement", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const body = await response.json() as { message?: string; [key: string]: unknown };
      if (!response.ok) throw new Error(body.message || "No pudimos completar la operación.");
      return body;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No pudimos completar la operación.");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function saveSupplier(event: React.FormEvent) {
    event.preventDefault();
    const result = await mutate({
      action: "SAVE_SUPPLIER",
      ...supplier,
      leadTimeDays: Number(supplier.leadTimeDays)
    }, "POST");
    if (!result) return;
    setSupplier(emptySupplier);
    await load();
    setMessage("Proveedor guardado correctamente.");
  }

  async function createOrder(event: React.FormEvent) {
    event.preventDefault();
    const result = await mutate({
      action: "CREATE_ORDER",
      supplierId,
      requestKey,
      expectedAt,
      notes,
      items: orderLines.map((line) => ({ productId: line.productId, quantity: Number(line.quantity), unitCost: Number(line.unitCost) }))
    }, "POST");
    if (!result) return;
    setOrderLines([{ productId: "", quantity: "1", unitCost: "" }]);
    setExpectedAt("");
    setNotes("");
    setRequestKey(crypto.randomUUID());
    setTab("ORDERS");
    await load();
    setMessage(`Orden ${String(result.orderNumber ?? "")} creada como borrador.`);
  }

  async function sendOrder(orderId: string) {
    const result = await mutate({ action: "ORDER_PURCHASE", orderId }, "PATCH");
    if (!result) return;
    await load();
    setMessage("Orden marcada como enviada al proveedor.");
  }

  function openReceipt(order: ProcurementOrder) {
    const quantities = Object.fromEntries(order.items
      .filter((item) => item.quantity > item.received_quantity)
      .map((item) => [item.id, String(item.quantity - item.received_quantity)]));
    setReceiptQuantities(quantities);
    setReceivingOrderId(order.id);
    setCancellingOrderId(null);
  }

  async function receiveOrder(order: ProcurementOrder) {
    const items = order.items.map((item) => ({ itemId: item.id, quantity: Number(receiptQuantities[item.id] ?? 0) })).filter((item) => item.quantity > 0);
    const result = await mutate({ action: "RECEIVE_PURCHASE", orderId: order.id, items }, "PATCH");
    if (!result) return;
    setReceivingOrderId(null);
    await load();
    setMessage(result.status === "RECEIVED" ? "Mercadería recibida y stock actualizado." : "Recepción parcial registrada y stock actualizado.");
  }

  async function cancelOrder(orderId: string) {
    const result = await mutate({ action: "CANCEL_PURCHASE", orderId, reason: cancelReason }, "PATCH");
    if (!result) return;
    setCancellingOrderId(null);
    setCancelReason("");
    await load();
    setMessage("Orden cancelada con registro de auditoría.");
  }

  function updateLine(index: number, key: keyof OrderLine, value: string) {
    setOrderLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, [key]: value } : line));
  }

  return <div className="admin-procurement">
    <section className="admin-procurement__intro">
      <div><span className="kicker">Abastecimiento</span><h2>Compras con control de recepción</h2><p>Crear una orden no cambia el inventario. El stock aumenta únicamente cuando confirmás la mercadería recibida.</p></div>
      <Link className="btn btn--ghost" href={`${adminPath}/inventario`}><PackageCheck size={18} />Ver reposición sugerida</Link>
    </section>

    <nav className="admin-procurement__tabs" aria-label="Secciones de compras">
      <button className={tab === "ORDERS" ? "active" : ""} onClick={() => setTab("ORDERS")} type="button"><ClipboardList size={18} />Órdenes</button>
      <button className={tab === "CREATE" ? "active" : ""} onClick={() => setTab("CREATE")} type="button"><Plus size={18} />Nueva orden</button>
      <button className={tab === "SUPPLIERS" ? "active" : ""} onClick={() => setTab("SUPPLIERS")} type="button"><Building2 size={18} />Proveedores</button>
      <button aria-label="Actualizar compras" disabled={loading} onClick={() => void load()} type="button"><RefreshCw className={loading ? "is-spinning" : undefined} size={18} /></button>
    </nav>

    {message ? <p className={`notice ${message.includes("correctamente") || message.includes("actualizado") || message.includes("creada") ? "notice--success" : ""}`} role="status">{message}</p> : null}
    {loading && !data ? <section className="admin-procurement__loading" aria-label="Cargando compras"><span /><span /><span /></section> : null}
    {data && !data.ready ? <p className="notice notice--danger">El módulo de compras todavía no está disponible en la base de datos. Aplicá la migración aditiva antes de usarlo.</p> : null}

    {data?.ready ? <>
      <section className="admin-procurement__metrics" aria-label="Resumen de compras">
        <span><strong>{data.overview.drafts}</strong><small>Borradores</small></span>
        <span><strong>{data.overview.awaitingReceipt}</strong><small>Por recibir</small></span>
        <span><strong>{data.overview.partialReceipts}</strong><small>Parciales</small></span>
        <span><strong>{currency(data.overview.openCommitment)}</strong><small>Compromiso abierto</small></span>
        <span><strong>{data.overview.activeSuppliers}</strong><small>Proveedores activos</small></span>
      </section>

      {tab === "ORDERS" ? <section className="admin-procurement__orders">
        <header><div><span className="kicker">Seguimiento</span><h2>Órdenes de compra</h2></div><button className="btn btn--primary" onClick={() => setTab("CREATE")} type="button"><Plus size={18} />Nueva orden</button></header>
        {!data.orders.length ? <p className="admin-empty">Todavía no hay órdenes. Creá la primera desde “Nueva orden”.</p> : data.orders.map((order) => {
          const expanded = expandedOrderId === order.id;
          const canReceive = order.status === "ORDERED" || order.status === "PARTIALLY_RECEIVED";
          return <article className={`admin-procurement-order admin-procurement-order--${statusTone(order.status)}`} key={order.id}>
            <div className="admin-procurement-order__main">
              <button aria-expanded={expanded} className="admin-procurement-order__toggle" onClick={() => setExpandedOrderId(expanded ? null : order.id)} type="button"><ChevronDown size={18} /></button>
              <div><strong>{order.order_number}</strong><small>{order.supplier?.name ?? "Proveedor"} · {order.items.length} productos</small></div>
              <span><small>Total</small><strong>{currency(order.total)}</strong></span>
              <span><small>Entrega esperada</small><strong>{localDate(order.expected_at)}</strong></span>
              <span className={`status-pill status-pill--${statusTone(order.status)}`}>{statusLabels[order.status]}</span>
              <div className="admin-procurement-order__actions">
                {order.status === "DRAFT" ? <button className="btn btn--primary" disabled={saving} onClick={() => void sendOrder(order.id)} type="button"><Send size={17} />Enviar</button> : null}
                {canReceive ? <button className="btn btn--primary" disabled={saving} onClick={() => openReceipt(order)} type="button"><Truck size={17} />Recibir</button> : null}
                {order.status === "DRAFT" || order.status === "ORDERED" ? <button className="btn btn--ghost" disabled={saving} onClick={() => { setCancellingOrderId(order.id); setReceivingOrderId(null); }} type="button"><X size={17} />Cancelar</button> : null}
              </div>
            </div>
            {expanded ? <div className="admin-procurement-order__items">{order.items.map((item) => <span key={item.id}><strong>{item.product_name}</strong><small>{item.sku}</small><em>{item.received_quantity}/{item.quantity} {item.unit}</em><b>{currency(item.unit_cost)} c/u</b></span>)}</div> : null}
            {receivingOrderId === order.id ? <div className="admin-procurement-order__panel"><div><strong>Confirmar recepción</strong><p>Indicá solo lo que llegó físicamente. Esta acción aumenta stock y queda auditada.</p></div>{order.items.filter((item) => item.quantity > item.received_quantity).map((item) => <label key={item.id}>{item.product_name}<input inputMode="numeric" max={item.quantity - item.received_quantity} min="0" onChange={(event) => setReceiptQuantities((current) => ({ ...current, [item.id]: event.target.value }))} type="number" value={receiptQuantities[item.id] ?? "0"} /><small>Pendiente: {item.quantity - item.received_quantity} {item.unit}</small></label>)}<div className="admin-procurement-order__panel-actions"><button className="btn btn--ghost" onClick={() => setReceivingOrderId(null)} type="button">Volver</button><button className="btn btn--primary" disabled={saving} onClick={() => void receiveOrder(order)} type="button"><CheckCircle2 size={17} />Confirmar recepción</button></div></div> : null}
            {cancellingOrderId === order.id ? <div className="admin-procurement-order__panel"><label>Motivo de cancelación<textarea maxLength={240} onChange={(event) => setCancelReason(event.target.value)} rows={2} value={cancelReason} /></label><div className="admin-procurement-order__panel-actions"><button className="btn btn--ghost" onClick={() => setCancellingOrderId(null)} type="button">Volver</button><button className="btn btn--danger" disabled={saving || cancelReason.trim().length < 3} onClick={() => void cancelOrder(order.id)} type="button">Cancelar orden</button></div></div> : null}
          </article>;
        })}
      </section> : null}

      {tab === "CREATE" ? <form className="admin-procurement__form" onSubmit={createOrder}>
        <header><div><span className="kicker">Nueva compra</span><h2>Preparar orden</h2><p>Elegí proveedor, productos, cantidades y costo de compra. Podrás revisarla antes de enviarla.</p></div><strong>{currency(orderTotal)}</strong></header>
        <div className="admin-procurement__form-grid"><label>Proveedor<select onChange={(event) => setSupplierId(event.target.value)} required value={supplierId}><option value="">Elegí un proveedor</option>{data.suppliers.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name} · {item.lead_time_days} días</option>)}</select></label><label>Entrega esperada<input onChange={(event) => setExpectedAt(event.target.value)} type="date" value={expectedAt} /></label></div>
        <div className="admin-procurement__lines"><div className="admin-procurement__line-head"><strong>Productos</strong><button className="btn btn--ghost" onClick={() => setOrderLines((current) => [...current, { productId: "", quantity: "1", unitCost: "" }])} type="button"><Plus size={17} />Agregar producto</button></div>{orderLines.map((line, index) => <div className="admin-procurement__line" key={`${index}-${line.productId}`}><label>Producto<select onChange={(event) => updateLine(index, "productId", event.target.value)} required value={line.productId}><option value="">Elegí un producto</option>{data.products.map((product) => <option disabled={orderLines.some((other, otherIndex) => otherIndex !== index && other.productId === product.id)} key={product.id} value={product.id}>{product.name} · stock {product.stock}</option>)}</select></label><label>Cantidad<input inputMode="numeric" min="1" onChange={(event) => updateLine(index, "quantity", event.target.value)} required type="number" value={line.quantity} /></label><label>Costo unitario<input inputMode="decimal" min="0.01" onChange={(event) => updateLine(index, "unitCost", event.target.value)} required step="0.01" type="number" value={line.unitCost} /></label><button aria-label="Quitar producto" disabled={orderLines.length === 1} onClick={() => setOrderLines((current) => current.filter((_, lineIndex) => lineIndex !== index))} type="button"><X size={18} /></button></div>)}</div>
        <label>Notas para la compra<textarea maxLength={600} onChange={(event) => setNotes(event.target.value)} placeholder="Condiciones acordadas, presentación o referencia interna" rows={3} value={notes} /></label>
        {!data.suppliers.some((item) => item.active) ? <p className="notice">Primero cargá un proveedor activo.</p> : null}
        <footer><button className="btn btn--ghost" onClick={() => setTab("ORDERS")} type="button">Cancelar</button><button className="btn btn--primary" disabled={saving || !data.suppliers.some((item) => item.active)} type="submit"><ShoppingBasket size={18} />Crear borrador</button></footer>
      </form> : null}

      {tab === "SUPPLIERS" ? <section className="admin-procurement__supplier-layout">
        <form className="admin-procurement__form" onSubmit={saveSupplier}><header><div><span className="kicker">Directorio privado</span><h2>{supplier.id ? "Editar proveedor" : "Nuevo proveedor"}</h2></div>{supplier.id ? <button className="btn btn--ghost" onClick={() => setSupplier(emptySupplier)} type="button">Nuevo</button> : null}</header><div className="admin-procurement__form-grid"><label>Código<input maxLength={40} onChange={(event) => setSupplier({ ...supplier, code: event.target.value.toUpperCase() })} required value={supplier.code} /></label><label>Razón social / nombre<input maxLength={140} onChange={(event) => setSupplier({ ...supplier, name: event.target.value })} required value={supplier.name} /></label><label>Contacto<input maxLength={120} onChange={(event) => setSupplier({ ...supplier, contactName: event.target.value })} value={supplier.contactName} /></label><label>CUIT<input inputMode="numeric" maxLength={20} onChange={(event) => setSupplier({ ...supplier, taxId: event.target.value })} value={supplier.taxId} /></label><label>Email<input maxLength={180} onChange={(event) => setSupplier({ ...supplier, email: event.target.value })} type="email" value={supplier.email} /></label><label>Teléfono<input inputMode="tel" maxLength={30} onChange={(event) => setSupplier({ ...supplier, phone: event.target.value })} value={supplier.phone} /></label><label>Plazo habitual (días)<input max="120" min="1" onChange={(event) => setSupplier({ ...supplier, leadTimeDays: event.target.value })} required type="number" value={supplier.leadTimeDays} /></label><label>Condiciones de pago<input maxLength={180} onChange={(event) => setSupplier({ ...supplier, paymentTerms: event.target.value })} value={supplier.paymentTerms} /></label></div><label>Notas<textarea maxLength={600} onChange={(event) => setSupplier({ ...supplier, notes: event.target.value })} rows={3} value={supplier.notes} /></label><label className="admin-procurement__check"><input checked={supplier.active} onChange={(event) => setSupplier({ ...supplier, active: event.target.checked })} type="checkbox" />Proveedor activo</label><footer><button className="btn btn--primary" disabled={saving} type="submit"><Building2 size={18} />Guardar proveedor</button></footer></form>
        <div className="admin-procurement__suppliers"><header><span className="kicker">Proveedores</span><strong>{data.suppliers.length}</strong></header>{!data.suppliers.length ? <p className="admin-empty">No hay proveedores cargados.</p> : data.suppliers.map((item) => <button className={item.active ? "" : "is-inactive"} key={item.id} onClick={() => setSupplier(supplierToForm(item))} type="button"><span><strong>{item.name}</strong><small>{item.code} · {item.contact_name || "Sin contacto"}</small></span><em>{item.lead_time_days} días</em></button>)}</div>
      </section> : null}
    </> : null}
  </div>;
}
