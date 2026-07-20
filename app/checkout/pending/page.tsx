import Link from "next/link";
import { Clock3, MessageCircle } from "lucide-react";
import { getWhatsAppHref } from "@/lib/utils/contact";

export default async function Page({
  searchParams
}: {
  searchParams: Promise<{ orderId?: string; order_id?: string; approval?: string; transfer?: string; whatsapp?: string }>;
}) {
  const params = await searchParams;
  const orderId = params.orderId || params.order_id || "";
  const reference = orderId ? orderId.slice(0, 8).toUpperCase() : null;
  const requiresApproval = params.approval === "1";
  const transferPending = params.transfer === "1";
  const whatsappPending = params.whatsapp === "1";
  const whatsappHref = getWhatsAppHref(
    transferPending
      ? `Hola FZAC, generé un pedido para pagar por transferencia${reference ? ` con referencia ${reference}` : ""} y necesito los datos bancarios.`
      : whatsappPending
        ? `Hola FZAC, generé un pedido${reference ? ` con referencia ${reference}` : ""} y quiero coordinar el pago.`
        : requiresApproval
      ? `Hola FZAC, mi compra requiere validación${reference ? ` con referencia ${reference}` : ""} y quiero consultar el estado.`
      : `Hola FZAC, mi pago quedó pendiente${reference ? ` con referencia ${reference}` : ""} y quiero consultar el estado.`
  );
  const title = transferPending
    ? "Pedido pendiente de transferencia"
    : whatsappPending
      ? "Pedido listo para coordinar"
      : requiresApproval
        ? "Compra en validación"
        : "Pago pendiente";
  const description = transferPending
    ? "Generamos tu pedido. FZAC revisará stock, total y te indicará los datos bancarios para transferir."
    : whatsappPending
      ? "Generamos tu pedido. Podés continuar por WhatsApp para coordinar pago, retiro o entrega con el equipo de FZAC."
      : requiresApproval
        ? "Tu compra requiere validación de FZAC por el monto o volumen del pedido. El equipo la revisará y te contactará."
        : "Tu pedido quedó pendiente. Te avisaremos cuando el pago o la revisión estén confirmados.";

  return (
    <main className="page-section">
      <div className="container empty-state">
        <div>
          <Clock3 size={42} />
          <h1>{title}</h1>
          <p>{description}</p>
          {reference ? <p>Referencia de pedido: {reference}</p> : null}
          <Link className="btn" href="/cuenta/pedidos">
            Ver pedido
          </Link>
          <Link className="btn btn--ghost" href="/productos">
            Volver al catálogo
          </Link>
          <a className="btn btn--ghost" href={whatsappHref} target="_blank" rel="noreferrer">
            <MessageCircle size={17} /> Consultar por WhatsApp
          </a>
        </div>
      </div>
    </main>
  );
}
