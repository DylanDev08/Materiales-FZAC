import Link from "next/link";
import { Clock3, MessageCircle } from "lucide-react";
import { getWhatsAppHref } from "@/lib/utils/contact";

export default async function Page({
  searchParams
}: {
  searchParams: Promise<{ orderId?: string; order_id?: string; approval?: string; transfer?: string }>;
}) {
  const params = await searchParams;
  const orderId = params.orderId || params.order_id || "";
  const reference = orderId ? orderId.slice(0, 8).toUpperCase() : null;
  const requiresApproval = params.approval === "1";
  const transferPending = params.transfer === "1";

  const whatsappHref = getWhatsAppHref(
    transferPending
      ? `Hola FZAC, elegí transferencia para el pedido${reference ? ` #${reference}` : ""}. Necesito los datos bancarios y después voy a enviar el comprobante por este chat.`
      : requiresApproval
        ? `Hola FZAC, mi compra${reference ? ` #${reference}` : ""} requiere validación por el monto. Quiero consultar el estado antes de pagar.`
        : `Hola FZAC, quiero consultar el estado del pago${reference ? ` del pedido #${reference}` : ""}.`
  );

  const title = transferPending
    ? "Transferencia pendiente de comprobante"
    : requiresApproval
      ? "Compra en validación"
      : "Pago pendiente";

  const description = transferPending
    ? "El pedido ya está registrado. Pedí los datos bancarios, realizá la transferencia y enviá el comprobante por WhatsApp. FZAC prepara el pedido cuando verifica la acreditación."
    : requiresApproval
      ? "Por el monto de la compra, FZAC debe validarla antes de habilitar el pago."
      : "El proveedor de pago todavía no informó una aprobación definitiva. No vuelvas a pagar mientras el estado esté pendiente.";

  return (
    <main className="page-section">
      <div className="container empty-state">
        <div>
          <Clock3 size={42} />
          <h1>{title}</h1>
          <p>{description}</p>
          {reference ? <p>Referencia de pedido: {reference}</p> : null}
          <Link className="btn" href="/cuenta/pedidos">Ver pedido</Link>
          {transferPending ? (
            <a className="btn" href={whatsappHref} target="_blank" rel="noreferrer">
              <MessageCircle size={17} /> Pedir datos / enviar comprobante
            </a>
          ) : (
            <a className="btn btn--ghost" href={whatsappHref} target="_blank" rel="noreferrer">
              <MessageCircle size={17} /> Consultar por WhatsApp
            </a>
          )}
          <Link className="btn btn--ghost" href="/productos">Volver al catálogo</Link>
        </div>
      </div>
    </main>
  );
}
