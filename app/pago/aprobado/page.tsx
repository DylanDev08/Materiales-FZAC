import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { ReceiptActions } from "@/components/orders/receipt-actions";
import { ReceiptTemplate } from "@/components/orders/receipt-template";
import { getOrderReceipt } from "@/lib/db/receipts";

export default async function Page({ searchParams }: { searchParams: Promise<{ order_id?: string }> }) {
  const { order_id: orderId } = await searchParams;
  const reference = orderId ? orderId.slice(0, 8).toUpperCase() : null;
  const receipt = await getOrderReceipt(orderId);

  return (
    <main className="page-section">
      <div className="container empty-state">
        <div>
          <CheckCircle2 size={42} />
          <h1>{receipt ? "Pago aprobado" : "Estamos verificando el pago"}</h1>
          <p>{receipt ? "Tu pago fue confirmado. FZAC preparará el pedido y coordinará retiro o entrega." : "Estamos confirmando el estado con Mercado Pago. No repitas la operación hasta ver el pedido actualizado."}</p>
          {reference ? <p>Referencia de pedido: {reference}</p> : null}
          <Link className="btn" href="/cuenta/pedidos">
            Ver pedidos
          </Link>
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
