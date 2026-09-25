import Link from "next/link";
import { Home, RefreshCcw, WifiOff } from "lucide-react";

export const metadata = { title: "Sin conexión | Materiales FZAC", robots: { index: false, follow: false } };

export default function OfflinePage() {
  return (
    <main className="status-page">
      <section className="status-page__card">
        <div className="status-page__code" aria-hidden="true"><span>SIN CONEXIÓN</span><strong>OFF</strong></div>
        <div className="status-page__content">
          <span className="status-page__eyebrow"><WifiOff size={17} /> Conexión interrumpida</span>
          <h1>No pudimos conectar con la tienda.</h1>
          <p>Revisá tu Wi‑Fi o datos móviles y volvé a intentar. Si estabas enviando un pedido o pago, evitá repetirlo hasta recuperar conexión y confirmar su estado.</p>
          <div className="status-page__actions">
            <Link className="btn" href="/"><RefreshCcw size={17} /> Reintentar</Link>
            <Link className="btn btn--ghost" href="/"><Home size={17} /> Inicio</Link>
          </div>
        </div>
      </section>
    </main>
  );
}