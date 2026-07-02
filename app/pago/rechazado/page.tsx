import Link from "next/link";
import { XCircle } from "lucide-react";

export default function Page() {
  return (
    <main className="page-section">
      <div className="container empty-state">
        <div>
          <XCircle size={42} />
          <h1>Pago rechazado</h1>
          <p>No se confirmo el pago. No se desconto stock ni se emitio ticket.</p>
          <Link className="btn" href="/checkout">
            Reintentar
          </Link>
        </div>
      </div>
    </main>
  );
}
