import Link from "next/link";
import { CheckCircle2, MessageCircle } from "lucide-react";
import { ReceiptActions } from "@/components/orders/receipt-actions";
import { ReceiptTemplate } from "@/components/orders/receipt-template";
import { getOrderReceipt } from "@/lib/db/receipts";
import { getWhatsAppHref } from "@/lib/utils/contact";

export default async function Page({ searchParams }: { searchParams: Promise<{ orderId?: string; order_id?: string }> }) {
  const params = await searchParams;
  const orderId = params.orderId || params.order_id || "";
  const reference = orderId ? orderId.slice(0, 8).toUpperCase() : null;
  const receipt = await getOrderReceipt(orderId);
  const whatsappHref = getWhatsAppHref(
    `Hola FZAC, hice una compra por Mercado Pago${reference ? ` con referencia ${reference}` : ""} y quiero consultar el estado.`
  );

  return (
    <main className="page-section">
      <div className="container empty-state">
        <div>
          <CheckCircle2 size={42} />
          <h1>{receipt ? "Pago confirmado" : "Confirmacion recibida"}</h1>
          <p>
            {receipt
              ? "Recibimos la confirmacion de Mercado Pago. Ya emitimos el comprobante FZAC y el equipo esta validando tu pedido."
              : "Recibimos la confirmacion de Mercado Pago. FZAC esta validando tu pedido y actualizara el estado automaticamente."}
          </p>
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
      {receipt ? (
        <div className="container" style={{ marginTop: 22 }}>
          <ReceiptActions />
          <ReceiptTemplate receipt={receipt} />
        </div>
      ) : null}
    </main>
  );
}
