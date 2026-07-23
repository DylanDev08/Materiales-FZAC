import { Boxes, CalendarDays, CircleDollarSign, Clock3, Package, ReceiptText, RotateCcw, ShoppingBag } from "lucide-react";
import type { AccountOverview } from "@/lib/db/account";

const statusLabels: Record<string, string> = {
  PENDING_PAYMENT: "Pago pendiente",
  PENDING_TRANSFER: "Transferencia pendiente",
  PENDING_ADMIN_APPROVAL: "En revisión",
  COORDINATE: "A coordinar",
  PAID: "Pago aprobado",
  CONFIRMED: "Confirmado",
  PREPARING: "En preparación",
  READY_FOR_PICKUP: "Listo para retirar",
  OUT_FOR_DELIVERY: "En camino",
  DELIVERED: "Entregado",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado"
};

export function AccountSummary({ overview }: { overview: AccountOverview }) {
  const rows = [
    { label: "Total comprado", value: overview.totalSpent, icon: CircleDollarSign },
    { label: "Pendiente", value: overview.pendingAmount, icon: Clock3 },
    { label: "Pedidos", value: String(overview.ordersCount), icon: ShoppingBag },
    { label: "Productos comprados", value: String(overview.purchasedProducts), icon: Boxes }
  ];

  return (
    <section className="account-metrics" aria-label="Resumen de la cuenta">
      {rows.map(({ label, value, icon: Icon }) => (
        <span key={label}><Icon size={18} /><small>{label}</small><strong>{value}</strong></span>
      ))}
    </section>
  );
}

export function AccountOrders({ rows }: { rows: AccountOverview["orders"] }) {
  if (!rows.length) return <p className="account-empty">Todavía no hay pedidos para mostrar.</p>;
  return (
    <div className="account-order-list">
      {rows.map((order) => (
        <article key={order.id}>
          <Package size={20} />
          <div><strong>{order.total}</strong><span><CalendarDays size={14} /> {order.date} · {order.delivery}</span></div>
          <span className="status-pill">{statusLabels[order.status] ?? "En revisión"}</span>
        </article>
      ))}
    </div>
  );
}

export function AccountProducts({ rows }: { rows: AccountOverview["products"] }) {
  if (!rows.length) return <p className="account-empty">Los productos aparecerán cuando exista una compra aprobada.</p>;
  return (
    <div className="account-purchase-list">
      {rows.map((product) => (
        <article key={`${product.sku}-${product.name}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={product.imageUrl} alt={product.name} />
          <div><strong>{product.name}</strong><span>{product.quantity} unidades · {product.total}</span><small>Stock actual: {product.stock}</small></div>
          <ReceiptText size={18} />
        </article>
      ))}
    </div>
  );
}

const consumerRequestStatus: Record<string, string> = {
  RECEIVED: "Recibida",
  IN_REVIEW: "En revisión",
  APPROVED: "Aprobada para gestión",
  REJECTED: "Rechazada",
  CLOSED: "Cerrada"
};

const consumerRequestReasons: Record<string, string> = {
  PURCHASE_REGRET: "Arrepentimiento de compra",
  WRONG_PRODUCT: "Producto equivocado",
  DAMAGED_PRODUCT: "Producto dañado",
  NOT_DELIVERED: "Pedido no entregado",
  OTHER: "Otro motivo"
};

export function AccountConsumerRequests({ rows }: { rows: AccountOverview["consumerRequests"] }) {
  if (!rows.length) {
    return <p className="account-empty">No tenés solicitudes de arrepentimiento o devolución registradas.</p>;
  }

  return (
    <div className="account-consumer-request-list">
      {rows.map((request) => (
        <article key={request.id}>
          <RotateCcw size={20} />
          <div>
            <strong>{request.requestNumber}</strong>
            <span>{consumerRequestReasons[request.reason] ?? "Solicitud de consumidor"} · {request.createdAt}</span>
            {request.orderNumber ? <small>Pedido: {request.orderNumber}</small> : null}
            {request.resolutionNote ? <p>{request.resolutionNote}</p> : null}
          </div>
          <span className="status-pill">{consumerRequestStatus[request.status] ?? "En revisión"}</span>
        </article>
      ))}
    </div>
  );
}
