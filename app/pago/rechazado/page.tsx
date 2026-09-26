import Link from "next/link";
import { redirect } from "next/navigation";
import { getOwnedOrderPaymentState } from "@/lib/db/payment-state";
import { XCircle } from "lucide-react";

export default async function Page({ searchParams }: { searchParams: Promise<{ order_id?: string }> }) {
  const { order_id: orderId } = await searchParams;
  const reference = orderId ? orderId.slice(0, 8).toUpperCase() : null;
  const state = await getOwnedOrderPaymentState(orderId);
  const paymentStatus = state?.paymentStatus?.toUpperCase() ?? "";
  if (paymentStatus === "PAID") redirect(`/pago/aprobado?order_id=${encodeURIComponent(orderId ?? "")}`);
  if (["PENDING", "IN_PROCESS"].includes(paymentStatus)) {
    redirect(`/pago/pendiente?order_id=${encodeURIComponent(orderId ?? "")}`);
  }

  return (
    <main className="page-section">
      <div className="container empty-state">
        <div>
          <XCircle size={42} />
          <h1>Pago rechazado</h1>
          <p>No se confirmó el pago. No se descontó stock ni se emitió comprobante. Podés volver al checkout y elegir otro medio.</p>
          {reference ? <p>Referencia de pedido: {reference}</p> : null}
          <Link className="btn" href="/checkout">
            Reintentar
          </Link>
        </div>
      </div>
    </main>
  );
}
