import Link from "next/link";
import { MessageCircle, XCircle } from "lucide-react";
import { getWhatsAppHref } from "@/lib/utils/contact";

export default async function Page({ searchParams }: { searchParams: Promise<{ orderId?: string; order_id?: string }> }) {
  const params = await searchParams;
  const orderId = params.orderId || params.order_id || "";
  const reference = orderId ? orderId.slice(0, 8).toUpperCase() : null;
  const retryHref = orderId ? `/checkout?orderId=${encodeURIComponent(orderId)}` : "/checkout";
  const whatsappHref = getWhatsAppHref(
    `Hola FZAC, no pude confirmar el pago${reference ? ` de la referencia ${reference}` : ""} y necesito ayuda.`
  );

  return (
    <main className="page-section">
      <div className="container empty-state">
        <div>
          <XCircle size={42} />
          <h1>No pudimos confirmar el pago</h1>
          <p>No pudimos confirmar el pago. Podés reintentar con Mercado Pago o coordinar la compra con FZAC.</p>
          {reference ? <p>Referencia de pedido: {reference}</p> : null}
          <Link className="btn" href={retryHref}>
            Reintentar pago
          </Link>
          <Link className="btn btn--ghost" href="/carrito">
            Volver al carrito
          </Link>
          <a className="btn btn--ghost" href={whatsappHref} target="_blank" rel="noreferrer">
            <MessageCircle size={17} /> WhatsApp
          </a>
        </div>
      </div>
    </main>
  );
}
