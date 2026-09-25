import Link from "next/link";
import { Clock3, HardHat, Home, RefreshCcw } from "lucide-react";

export const metadata = { title: "Mantenimiento | Materiales FZAC", robots: { index: false, follow: false } };

export default function MaintenancePage() {
  return (
    <main className="status-page">
      <section className="status-page__card">
        <div className="status-page__code" aria-hidden="true"><span>ACTUALIZACIÓN EN CURSO</span><strong>503</strong></div>
        <div className="status-page__content">
          <span className="status-page__eyebrow"><HardHat size={17} /> Materiales FZAC</span>
          <h1>Estamos ajustando la tienda.</h1>
          <p>La web está recibiendo una actualización. Tu cuenta, pedidos y datos permanecen protegidos; no hace falta repetir compras ni pagos mientras esta pantalla esté activa.</p>
          <ul className="status-page__steps">
            <li>Si estabas navegando, podés volver a intentar en unos minutos.</li>
            <li>Si estabas pagando, verificá primero el estado de tu pedido antes de repetir la operación.</li>
            <li>El panel interno y los servicios críticos pueden seguir operando durante el mantenimiento.</li>
          </ul>
          <div className="status-page__actions">
            <Link className="btn" href="/"><RefreshCcw size={17} /> Volver a intentar</Link>
            <Link className="btn btn--ghost" href="/contacto"><Clock3 size={17} /> Contactar a FZAC</Link>
          </div>
        </div>
      </section>
    </main>
  );
}