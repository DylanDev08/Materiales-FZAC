import Link from "next/link";
import { redirect } from "next/navigation";
import { Clock3, MessageCircle } from "lucide-react";
import { getUserProfile } from "@/lib/auth/get-user";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getWhatsAppHref } from "@/lib/utils/contact";

function money(value: unknown) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0
  }).format(Number(value ?? 0));
}

async function whatsappOrderHref(orderId: string) {
  const profile = await getUserProfile();
  const admin = getSupabaseAdminClient();
  if (!profile || !admin) return null;

  let orderQuery = admin
    .from("orders")
    .select("id,user_id,total,subtotal,shipping_cost,shipping_method,customer_name")
    .eq("id", orderId);
  if (profile.role !== "ADMIN") orderQuery = orderQuery.eq("user_id", profile.id);

  const { data: order } = await orderQuery.maybeSingle();
  if (!order) return null;

  const { data: items } = await admin
    .from("order_items")
    .select("name,quantity,unit_price,line_total")
    .eq("order_id", order.id)
    .order("created_at", { ascending: true });

  const reference = String(order.id).slice(0, 8).toUpperCase();
  const lines = (items ?? []).map((item) => {
    const quantity = Number(item.quantity ?? 0);
    const lineTotal = Number(item.line_total ?? Number(item.unit_price ?? 0) * quantity);
    return `- ${quantity} x ${String(item.name || "Producto")} — ${money(lineTotal)}`;
  });
  const delivery = String(order.shipping_method) === "DELIVERY"
    ? `Envío: ${money(order.shipping_cost)}`
    : "Entrega: retiro coordinado";

  const message = [
    "Hola FZAC Materiales, quiero confirmar mi encargo.",
    "",
    `Pedido: ${reference}`,
    `Cliente: ${String(order.customer_name || "Cliente")}`,
    "",
    "Productos:",
    ...lines,
    "",
    delivery,
    `Total: ${money(order.total)}`,
    "",
    "Necesito los datos para realizar la transferencia."
  ].join("\n");

  return getWhatsAppHref(message);
}

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

  if (whatsappPending && orderId) {
    const href = await whatsappOrderHref(orderId);
    if (href) redirect(href);
  }

  const whatsappHref = getWhatsAppHref(
    transferPending
      ? `Hola FZAC, generé un pedido para pagar por transferencia${reference ? ` con referencia ${reference}` : ""} y necesito los datos bancarios.`
      : whatsappPending
        ? `Hola FZAC, generé un pedido${reference ? ` con referencia ${reference}` : ""} y necesito los datos para realizar la transferencia.`
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
      ? "Generamos tu pedido. Continuá por WhatsApp para recibir los datos de transferencia y coordinar entrega o retiro."
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
            <MessageCircle size={17} /> Continuar por WhatsApp
          </a>
        </div>
      </div>
    </main>
  );
}
