import Link from "next/link";
import { CheckCircle2, MessageCircle } from "lucide-react";
import { PaymentReturnReconciler } from "@/components/payments/payment-return-reconciler";
import { ReceiptActions } from "@/components/orders/receipt-actions";
import { ReceiptTemplate } from "@/components/orders/receipt-template";
import { getOrderReceipt } from "@/lib/db/receipts";
import { getWhatsAppHref } from "@/lib/utils/contact";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Page({
  searchParams
}: {
  searchParams: Promise<{
    orderId?: string;
    order_id?: string;
    payment_id?: string;
    collection_id?: string;
    status?: string;
    collection_status?: string;
  }>;
}) {
  const params = await searchParams;
  const orderId = params.orderId || params.order_id || "";
  const providerPaymentId = params.payment_id || params.collection_id || "";
  const reference = orderId ? orderId.slice(0, 8).toUpperCase() : null;
  const receipt = await getOrderReceipt(orderId);
  const whatsappHref = getWhatsAppHref(
    `Hola FZAC, hice una compra${reference ? ` con referencia ${reference}` : ""} y quiero consultar el comprobante.`
  );

  return (
    <main className="page-section payment-approved-page">
      <div className="container payment-approved-hero">
        <div className="payment-approved-hero__icon"><CheckCircle2 size={34} /></div>
        <div>
          <span className="kicker">Compra FZAC</span>
          <h1>{receipt ? "Pago aprobado y comprobante emitido" : "Pago recibido, estamos emitiendo tu comprobante"}</h1>
          <p>
            {receipt
              ? "Tu compra quedó confirmada. Abajo tenés el detalle completo y podés descargar el comprobante en PDF."
              : "Estamos confirmando el pago y generando el comprobante. No repitas la operación."}
          </p>
          {reference ? <strong>Pedido #{reference}</strong> : null}
        </div>
      </div>

      {!receipt && orderId && providerPaymentId ? (
        <div className="container payment-approved-reconcile">
          <PaymentReturnReconciler orderId={orderId} paymentId={providerPaymentId} />
        </div>
      ) : null}

      {receipt ? (
        <div className="container receipt-page-shell">
          <div className="receipt-page-toolbar">
            <div>
              <span className="kicker">Comprobante de compra</span>
              <h2>Detalle de tu operación</h2>
              <p>Monto, artículos, cantidades, códigos, fecha, pago y entrega en un solo documento.</p>
            </div>
            <ReceiptActions orderId={receipt.orderId} reference={receipt.reference} />
          </div>
          <ReceiptTemplate receipt={receipt} />
        </div>
      ) : null}

      <div className="container payment-approved-actions">
        <Link className="btn btn--ghost" href="/cuenta/pedidos">Ver mis pedidos</Link>
        <Link className="btn btn--ghost" href="/productos">Seguir comprando</Link>
        <a className="btn btn--ghost" href={whatsappHref} target="_blank" rel="noreferrer">
          <MessageCircle size={17} /> Consultar por WhatsApp
        </a>
      </div>
    </main>
  );
}
