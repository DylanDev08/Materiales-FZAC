import Link from "next/link";
import { XCircle } from "lucide-react";

export default async function Page({ searchParams }: { searchParams: Promise<{ order_id?: string }> }) {
  const { order_id: orderId } = await searchParams;
  const reference = orderId ? orderId.slice(0, 8).toUpperCase() : null;

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
