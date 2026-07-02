import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

export default function Page() {
  return (
    <main className="page-section">
      <div className="container empty-state">
        <div>
          <CheckCircle2 size={42} />
          <h1>Pago aprobado</h1>
          <p>Tu pedido fue confirmado. FZAC generara el ticket y coordinara entrega o retiro.</p>
          <Link className="btn" href="/cuenta/pedidos">
            Ver pedidos
          </Link>
        </div>
      </div>
    </main>
  );
}
