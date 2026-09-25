import Link from "next/link";
import { Home, RefreshCcw, ServerCrash } from "lucide-react";

export const metadata = { title: "Servicio temporalmente no disponible | Materiales FZAC", robots: { index: false, follow: false } };

export default function ServiceUnavailablePage() {
  return (
    <main className="status-page">
      <section className="status-page__card">
        <div className="status-page__code" aria-hidden="true"><span>SERVICIO NO DISPONIBLE</span><strong>503</strong></div>
        <div className="status-page__content">
          <span className="status-page__eyebrow"><ServerCrash size={17} /> Interrupción temporal</span>
          <h1>Una parte de la tienda no está respondiendo.</h1>
          <p>Puede tratarse del catálogo, autenticación, base de datos o un proveedor externo. Evitamos continuar con operaciones incompletas para proteger pedidos, stock y pagos.</p>
          <div className="status-page__detail">Si estabas en checkout o realizando un pago, no repitas la operación hasta confirmar el estado del pedido.</div>
          <div className="status-page__actions">
            <Link className="btn" href="/"><RefreshCcw size={17} /> Reintentar</Link>
            <Link className="btn btn--ghost" href="/"><Home size={17} /> Inicio</Link>
          </div>
        </div>
      </section>
    </main>
  );
}