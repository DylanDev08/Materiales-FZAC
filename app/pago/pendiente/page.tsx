import Link from "next/link";
import { Clock3 } from "lucide-react";

export default function Page() {
  return (
    <main className="page-section">
      <div className="container empty-state">
        <div>
          <Clock3 size={42} />
          <h1>Pago pendiente</h1>
          <p>El pedido queda pendiente hasta que el proveedor confirme el pago.</p>
          <Link className="btn" href="/cuenta/pedidos">
            Ver estado
          </Link>
        </div>
      </div>
    </main>
  );
}
