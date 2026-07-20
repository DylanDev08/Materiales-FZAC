import Link from "next/link";
import { Clock3 } from "lucide-react";

export default async function Page({ searchParams }: { searchParams: Promise<{ order_id?: string }> }) {
  const { order_id: orderId } = await searchParams;
  const reference = orderId ? orderId.slice(0, 8).toUpperCase() : null;

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
