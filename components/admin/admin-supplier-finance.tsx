"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Ban,
  Banknote,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  FilePlus2,
  History,
  Landmark,
  RefreshCw,
  Search,
  TrendingUp,
  WalletCards
} from "lucide-react";
import { currency } from "@/lib/formatters/currency";
import type {
  ProductCostEvolution,
  SupplierFinanceData,
  SupplierInvoice,
  SupplierPaymentMethod
} from "@/lib/procurement/supplier-finance-service";

type Tab = "PAYABLES" | "CREATE" | "COSTS";
type InvoiceFilter = "OPEN" | "OVERDUE" | "PAID" | "ALL";

const invoiceStatus: Record<SupplierInvoice["status"], string> = {
  PENDING: "Pendiente",
  PARTIALLY_PAID: "Pago parcial",
  PAID: "Pagada",
  VOID: "Anulada"
};

const methodLabels: Record<SupplierPaymentMethod, string> = {
  BANK_TRANSFER: "Transferencia",
  CASH: "Efectivo",
  CARD: "Tarjeta empresarial",
  OTHER: "Otro medio"
};

function dateInput(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function dateTimeInput() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", year: "numeric" })
    .format(new Date(`${value.slice(0, 10)}T12:00:00`));
}

function isOverdue(invoice: SupplierInvoice) {
  if (invoice.status !== "PENDING" && invoice.status !== "PARTIALLY_PAID") return false;
  return new Date(`${invoice.due_at}T23:59:59`).getTime() < Date.now();
}

function invoiceTone(invoice: SupplierInvoice) {
  if (invoice.status === "PAID") return "success";
  if (invoice.status === "VOID") return "muted";
  if (isOverdue(invoice)) return "danger";
  return "warning";
}

function costTone(row: ProductCostEvolution) {
  if (row.variation_percent === null || row.variation_percent === 0) return "neutral";
  return row.variation_percent > 0 ? "up" : "down";
}

async function requestSupplierFinance(signal?: AbortSignal) {
  const response = await fetch("/api/admin/supplier-finance", { cache: "no-store", signal });
  const body = await response.json() as SupplierFinanceData & { message?: string };
  if (!response.ok) throw new Error(body.message || "No pudimos cargar las cuentas de proveedores.");
  return body;
}

export function AdminSupplierFinance() {
  const [data, setData] = useState<SupplierFinanceData | null>(null);
  const [tab, setTab] = useState<Tab>("PAYABLES");
  const [filter, setFilter] = useState<InvoiceFilter>("OPEN");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "danger">("success");
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null);
  const [purchaseOrderId, setPurchaseOrderId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [issuedAt, setIssuedAt] = useState(dateInput);
  const [dueAt, setDueAt] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 15);
    return dateInput(date);
  });
  const [invoiceNotes, setInvoiceNotes] = useState("");
  const [invoiceRequestKey, setInvoiceRequestKey] = useState(() => crypto.randomUUID());
  const [payingInvoice, setPayingInvoice] = useState<SupplierInvoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<SupplierPaymentMethod>("BANK_TRANSFER");
  const [paymentReference, setPaymentReference] = useState("");
  const [paidAt, setPaidAt] = useState(dateTimeInput);
  const [paymentNotes, setPaymentNotes] = useState("");
  const [paymentRequestKey, setPaymentRequestKey] = useState(() => crypto.randomUUID());
  const [voidTarget, setVoidTarget] = useState<{ type: "invoice" | "payment"; id: string } | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [costSearch, setCostSearch] = useState("");

  async function load(signal?: AbortSignal) {
    setLoading(true);
    try {
      const body = await requestSupplierFinance(signal);
      setData(body);
      setPurchaseOrderId((current) => current || body.billableOrders[0]?.id || "");
      setInvoiceAmount((current) => current || (body.billableOrders[0] ? String(body.billableOrders[0].remaining_amount) : ""));
      setMessage("");
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setMessage(error instanceof Error ? error.message : "No pudimos cargar el módulo.");
        setMessageTone("danger");
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    void requestSupplierFinance(controller.signal)
      .then((body) => {
        if (!active) return;
        setData(body);
        setPurchaseOrderId(body.billableOrders[0]?.id || "");
        setInvoiceAmount(body.billableOrders[0] ? String(body.billableOrders[0].remaining_amount) : "");
      })
      .catch((error: unknown) => {
        if (active && !(error instanceof DOMException && error.name === "AbortError")) {
          setMessage(error instanceof Error ? error.message : "No pudimos cargar el módulo.");
          setMessageTone("danger");
        }
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; controller.abort(); };
  }, []);

  const selectedOrder = data?.billableOrders.find((order) => order.id === purchaseOrderId) ?? null;

  const visibleInvoices = useMemo(() => (data?.invoices ?? []).filter((invoice) => {
    if (filter === "ALL") return true;
    if (filter === "PAID") return invoice.status === "PAID";
    if (filter === "OVERDUE") return isOverdue(invoice);
    return invoice.status === "PENDING" || invoice.status === "PARTIALLY_PAID";
  }), [data?.invoices, filter]);

  const visibleCosts = useMemo(() => {
    const query = costSearch.trim().toLocaleLowerCase("es-AR");
    if (!query) return data?.costEvolution ?? [];
    return (data?.costEvolution ?? []).filter((row) => `${row.product_name} ${row.sku} ${row.latest_supplier}`.toLocaleLowerCase("es-AR").includes(query));
  }, [costSearch, data?.costEvolution]);

  async function mutate(payload: Record<string, unknown>, method: "POST" | "PATCH") {
    if (saving) return null;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/supplier-finance", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const body = await response.json() as { message?: string; [key: string]: unknown };
      if (!response.ok) throw new Error(body.message || "No pudimos completar la operación.");
      setMessageTone("success");
      return body;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No pudimos completar la operación.");
      setMessageTone("danger");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function createInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await mutate({
      action: "CREATE_INVOICE",
      purchaseOrderId,
      requestKey: invoiceRequestKey,
      invoiceNumber,
      amount: Number(invoiceAmount),
      issuedAt,
      dueAt,
      notes: invoiceNotes
    }, "POST");
    if (!result) return;
    setInvoiceNumber("");
    setInvoiceAmount("");
    setInvoiceNotes("");
    setInvoiceRequestKey(crypto.randomUUID());
    setTab("PAYABLES");
    await load();
    setMessage("Factura registrada. El importe quedó pendiente, sin modificar caja ni stock.");
  }

  function openPayment(invoice: SupplierInvoice) {
    setPayingInvoice(invoice);
    setPaymentAmount(String(invoice.amount - invoice.paid_amount));
    setPaymentMethod("BANK_TRANSFER");
    setPaymentReference("");
    setPaymentNotes("");
    setPaidAt(dateTimeInput());
    setPaymentRequestKey(crypto.randomUUID());
    setVoidTarget(null);
  }

  async function createPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!payingInvoice) return;
    const result = await mutate({
      action: "CREATE_PAYMENT",
      invoiceId: payingInvoice.id,
      requestKey: paymentRequestKey,
      amount: Number(paymentAmount),
      method: paymentMethod,
      reference: paymentReference,
      paidAt: new Date(paidAt).toISOString(),
      notes: paymentNotes
    }, "POST");
    if (!result) return;
    setPayingInvoice(null);
    await load();
    setMessage("Pago registrado y egreso incorporado al libro financiero.");
  }

  async function voidEntry() {
    if (!voidTarget) return;
    const result = await mutate({
      action: voidTarget.type === "invoice" ? "VOID_INVOICE" : "VOID_PAYMENT",
      [voidTarget.type === "invoice" ? "invoiceId" : "paymentId"]: voidTarget.id,
      reason: voidReason
    }, "PATCH");
    if (!result) return;
    setVoidTarget(null);
    setVoidReason("");
    await load();
    setMessage(voidTarget.type === "payment" ? "Pago y egreso asociado anulados con auditoría." : "Factura anulada con auditoría.");
  }

  return <div className="admin-supplier-finance">
    <section className="admin-supplier-finance__intro">
      <div>
        <span className="kicker">Control financiero de compras</span>
        <h2>De la factura al pago, sin duplicar egresos</h2>
        <p>La orden compromete dinero, la recepción modifica stock y el pago recién entonces registra el egreso de caja.</p>
      </div>
      <span className="admin-supplier-finance__rule"><CheckCircle2 size={18} />Trazabilidad activa</span>
    </section>

    <nav className="admin-supplier-finance__tabs" aria-label="Secciones de cuentas por pagar">
      <button className={tab === "PAYABLES" ? "active" : ""} onClick={() => setTab("PAYABLES")} type="button"><CalendarClock size={18} />Vencimientos</button>
      <button className={tab === "CREATE" ? "active" : ""} onClick={() => setTab("CREATE")} type="button"><FilePlus2 size={18} />Registrar factura</button>
      <button className={tab === "COSTS" ? "active" : ""} onClick={() => setTab("COSTS")} type="button"><TrendingUp size={18} />Evolución de costos</button>
      <button aria-label="Actualizar cuentas" disabled={loading} onClick={() => void load()} type="button"><RefreshCw className={loading ? "is-spinning" : undefined} size={18} /></button>
    </nav>

    {message ? <p className={`notice notice--${messageTone}`} role="status">{message}</p> : null}
    {loading && !data ? <section className="admin-supplier-finance__loading" aria-label="Cargando cuentas"><span /><span /><span /></section> : null}
    {data && !data.ready ? <p className="notice notice--danger">El módulo todavía no está disponible en la base de datos. Aplicá la migración aditiva antes de usarlo.</p> : null}

    {data?.ready ? <>
      <section className="admin-supplier-finance__metrics" aria-label="Resumen de cuentas por pagar">
        <span><WalletCards size={19} /><small>Saldo pendiente</small><strong>{currency(data.overview.outstanding)}</strong></span>
        <span className={data.overview.overdue ? "is-danger" : ""}><AlertTriangle size={19} /><small>Vencidas</small><strong>{data.overview.overdue}</strong></span>
        <span><CalendarClock size={19} /><small>Vencen en 7 días</small><strong>{data.overview.dueSoon}</strong></span>
        <span><Banknote size={19} /><small>Pagado este mes</small><strong>{currency(data.overview.paidThisMonth)}</strong></span>
        <span><FilePlus2 size={19} /><small>Órdenes sin facturar</small><strong>{data.overview.pendingDocuments}</strong></span>
      </section>

      {tab === "PAYABLES" ? <section className="admin-supplier-finance__payables">
        <header>
          <div><span className="kicker">Agenda de pagos</span><h2>Facturas de proveedores</h2></div>
          <div className="admin-supplier-finance__filters" aria-label="Filtrar facturas">
            {(["OPEN", "OVERDUE", "PAID", "ALL"] as const).map((value) => <button className={filter === value ? "active" : ""} key={value} onClick={() => setFilter(value)} type="button">{{ OPEN: "Pendientes", OVERDUE: "Vencidas", PAID: "Pagadas", ALL: "Todas" }[value]}</button>)}
          </div>
        </header>
        {!visibleInvoices.length ? <div className="admin-supplier-finance__empty"><CheckCircle2 size={28} /><strong>No hay facturas en esta vista</strong><p>Podés registrar documentos desde la pestaña “Registrar factura”.</p></div> : visibleInvoices.map((invoice) => {
          const expanded = expandedInvoice === invoice.id;
          const balance = invoice.amount - invoice.paid_amount;
          return <article className={`admin-supplier-invoice admin-supplier-invoice--${invoiceTone(invoice)}`} key={invoice.id}>
            <div className="admin-supplier-invoice__main">
              <button aria-expanded={expanded} aria-label={`Ver factura ${invoice.invoice_number}`} className="admin-supplier-invoice__toggle" onClick={() => setExpandedInvoice(expanded ? null : invoice.id)} type="button"><ChevronDown size={18} /></button>
              <div><strong>{invoice.supplier?.name ?? "Proveedor"}</strong><small>Factura {invoice.invoice_number} · {invoice.purchase_order?.order_number ?? "Orden"}</small></div>
              <span><small>Vence</small><strong>{shortDate(invoice.due_at)}</strong>{isOverdue(invoice) ? <em>Vencida</em> : null}</span>
              <span><small>Saldo</small><strong>{currency(balance)}</strong><em>de {currency(invoice.amount)}</em></span>
              <span className={`status-pill status-pill--${invoiceTone(invoice)}`}>{invoiceStatus[invoice.status]}</span>
              {(invoice.status === "PENDING" || invoice.status === "PARTIALLY_PAID") ? <button className="btn btn--primary" disabled={saving} onClick={() => openPayment(invoice)} type="button"><Landmark size={17} />Registrar pago</button> : null}
            </div>
            {expanded ? <div className="admin-supplier-invoice__detail">
              <div><span>Emisión</span><strong>{shortDate(invoice.issued_at)}</strong></div>
              <div><span>Pagado</span><strong>{currency(invoice.paid_amount)}</strong></div>
              <div><span>Notas</span><strong>{invoice.notes || "Sin notas"}</strong></div>
              {invoice.status === "PENDING" && invoice.paid_amount === 0 ? <button className="admin-supplier-finance__void" onClick={() => { setVoidTarget({ type: "invoice", id: invoice.id }); setVoidReason(""); setPayingInvoice(null); }} type="button"><Ban size={16} />Anular factura</button> : null}
              {invoice.payments.length ? <div className="admin-supplier-invoice__payments"><strong>Pagos registrados</strong>{invoice.payments.map((payment) => <span className={payment.status === "VOID" ? "is-void" : ""} key={payment.id}><b>{currency(payment.amount)}</b><small>{methodLabels[payment.method]} · {new Intl.DateTimeFormat("es-AR", { dateStyle: "short" }).format(new Date(payment.paid_at))}</small><em>{payment.reference || (payment.status === "VOID" ? "Anulado" : "Sin referencia")}</em>{payment.status === "ACTIVE" ? <button aria-label="Anular pago" onClick={() => { setVoidTarget({ type: "payment", id: payment.id }); setVoidReason(""); setPayingInvoice(null); }} type="button"><Ban size={15} /></button> : null}</span>)}</div> : null}
            </div> : null}
          </article>;
        })}
      </section> : null}

      {tab === "CREATE" ? <form className="admin-supplier-finance__form" onSubmit={createInvoice}>
        <header><div><span className="kicker">Documento recibido</span><h2>Registrar factura del proveedor</h2><p>Esta acción crea una deuda pendiente. No modifica stock ni registra un egreso hasta que confirmes el pago.</p></div>{selectedOrder ? <strong>{currency(selectedOrder.remaining_amount)}</strong> : null}</header>
        {!data.billableOrders.length ? <div className="admin-supplier-finance__empty"><CheckCircle2 size={28} /><strong>No hay órdenes pendientes de facturación</strong><p>Primero enviá una orden desde Compras y proveedores.</p></div> : <>
          <div className="admin-supplier-finance__form-grid">
            <label>Orden de compra<select required value={purchaseOrderId} onChange={(event) => { const next = data.billableOrders.find((order) => order.id === event.target.value); setPurchaseOrderId(event.target.value); setInvoiceAmount(next ? String(next.remaining_amount) : ""); }}><option value="">Elegí una orden</option>{data.billableOrders.map((order) => <option key={order.id} value={order.id}>{order.order_number} · {order.supplier_name} · disponible {currency(order.remaining_amount)}</option>)}</select></label>
            <label>Número de factura<input autoComplete="off" maxLength={80} placeholder="A-0001-00001234" required value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value.toUpperCase().replace(/[^A-Z0-9./-]/g, ""))} /></label>
            <label>Importe<input inputMode="decimal" max={selectedOrder?.remaining_amount} min="0.01" required step="0.01" type="number" value={invoiceAmount} onChange={(event) => setInvoiceAmount(event.target.value)} /></label>
            <label>Fecha de emisión<input required type="date" value={issuedAt} onChange={(event) => setIssuedAt(event.target.value)} /></label>
            <label>Vencimiento<input min={issuedAt} required type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></label>
          </div>
          <label>Notas internas<textarea maxLength={600} placeholder="Condiciones, diferencia documentada o referencia" rows={3} value={invoiceNotes} onChange={(event) => setInvoiceNotes(event.target.value)} /></label>
          <footer><button className="btn btn--ghost" onClick={() => setTab("PAYABLES")} type="button">Cancelar</button><button className="btn btn--primary" disabled={saving || !purchaseOrderId || !invoiceNumber || !invoiceAmount} type="submit"><FilePlus2 size={18} />Registrar factura</button></footer>
        </>}
      </form> : null}

      {tab === "COSTS" ? <section className="admin-supplier-finance__costs">
        <header><div><span className="kicker">Histórico de compra</span><h2>Evolución de costos</h2><p>Compara los últimos costos acordados. Nunca modifica el precio publicado automáticamente.</p></div><label><Search size={17} /><input aria-label="Buscar producto o proveedor" placeholder="Buscar producto o proveedor" value={costSearch} onChange={(event) => setCostSearch(event.target.value)} /></label></header>
        {!visibleCosts.length ? <div className="admin-supplier-finance__empty"><History size={28} /><strong>Todavía no hay comparaciones disponibles</strong><p>Se necesitan órdenes enviadas con costos registrados.</p></div> : <div className="admin-supplier-finance__cost-table"><div className="admin-supplier-finance__cost-head"><span>Producto</span><span>Último costo</span><span>Anterior</span><span>Variación</span><span>Proveedor</span></div>{visibleCosts.map((row) => {
          const tone = costTone(row);
          return <article key={row.product_id}><span><strong>{row.product_name}</strong><small>{row.sku} · {row.unit} · {row.observations} referencias</small></span><span><strong>{currency(row.latest_cost)}</strong><small>{shortDate(row.latest_at)}</small></span><span>{row.previous_cost === null ? "Sin anterior" : currency(row.previous_cost)}</span><span className={`admin-cost-variation admin-cost-variation--${tone}`}>{tone === "up" ? <ArrowUp size={15} /> : tone === "down" ? <ArrowDown size={15} /> : <ArrowRight size={15} />}{row.variation_percent === null ? "Primera compra" : `${Math.abs(row.variation_percent)}%`}</span><span><strong>{row.latest_supplier}</strong><small>{row.latest_order}</small></span></article>;
        })}</div>}
      </section> : null}
    </> : null}

    {payingInvoice ? <form className="admin-supplier-finance__drawer" onSubmit={createPayment}>
      <header><div><span className="kicker">Salida de caja</span><h2>Registrar pago</h2><p>{payingInvoice.supplier?.name} · factura {payingInvoice.invoice_number}</p></div><button aria-label="Cerrar pago" onClick={() => setPayingInvoice(null)} type="button">×</button></header>
      <div className="admin-supplier-finance__payment-balance"><span>Saldo pendiente</span><strong>{currency(payingInvoice.amount - payingInvoice.paid_amount)}</strong></div>
      <label>Importe pagado<input inputMode="decimal" max={payingInvoice.amount - payingInvoice.paid_amount} min="0.01" required step="0.01" type="number" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} /></label>
      <label>Medio de pago<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as SupplierPaymentMethod)}>{Object.entries(methodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Fecha y hora<input required type="datetime-local" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} /></label>
      <label>Referencia / comprobante<input maxLength={120} placeholder="Número de transferencia o recibo" value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} /></label>
      <label>Notas<textarea maxLength={600} rows={2} value={paymentNotes} onChange={(event) => setPaymentNotes(event.target.value)} /></label>
      <p><AlertTriangle size={17} />Al confirmar se crea un egreso auditable. No cargues este pago nuevamente en “Ingresos y egresos”.</p>
      <footer><button className="btn btn--ghost" onClick={() => setPayingInvoice(null)} type="button">Volver</button><button className="btn btn--primary" disabled={saving || !paymentAmount} type="submit"><Landmark size={18} />Confirmar pago</button></footer>
    </form> : null}

    {voidTarget ? <section className="admin-supplier-finance__void-panel">
      <div><Ban size={20} /><span><strong>{voidTarget.type === "payment" ? "Anular pago" : "Anular factura"}</strong><p>El registro seguirá visible y la acción quedará en la auditoría.</p></span></div>
      <label>Motivo obligatorio<input autoFocus maxLength={240} minLength={3} value={voidReason} onChange={(event) => setVoidReason(event.target.value)} /></label>
      <footer><button className="btn btn--ghost" onClick={() => setVoidTarget(null)} type="button">Volver</button><button className="btn btn--danger" disabled={saving || voidReason.trim().length < 3} onClick={() => void voidEntry()} type="button"><Ban size={17} />Confirmar anulación</button></footer>
    </section> : null}
  </div>;
}
