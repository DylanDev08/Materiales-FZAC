import Link from "next/link";
import { redirect } from "next/navigation";
import { getOwnedOrderPaymentState } from "@/lib/db/payment-state";
import { Clock3 } from "lucide-react";

export default async function Page({ searchParams }: { searchParams: Promise<{ order_id?: string }> }) {
  const { order_id: orderId } = await searchParams;
  const reference = orderId ? orderId.slice(0, 8).toUpperCase() : null;
  const state = await getOwnedOrderPaymentState(orderId);
  const paymentStatus = state?.paymentStatus?.toUpperCase() ?? "";
  if (paymentStatus === "PAID") redirect(`/pago/aprobado?order_id=${encodeURIComponent(orderId ?? "")}`);
  if (["FAILED", "EXPIRED", "REFUNDED"].includes(paymentStatus)) {
    redirect(`/pago/rechazado?order_id=${encodeURIComponent(orderId ?? "")}`);
  }

  return (
    <main className="page-section">
      <div className="container empty-state">
        <div>
          <Clock3 size={42} />
          <h1>Pago pendiente</h1>
          <p>El proveedor de pago todavía no confirmó la operación. Cuando se apruebe, FZAC actualizará el pedido automáticamente.</p>
          {reference ? <p>Referencia de pedido: {reference}</p> : null}
          <Link className="btn" href="/cuenta/pedidos">
            Ver estado
          </Link>
        </div>
      </div>
    </main>
  );
}
