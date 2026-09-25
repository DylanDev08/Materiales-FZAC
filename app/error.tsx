"use client";

import Link from "next/link";
import { AlertTriangle, Home, RefreshCcw } from "lucide-react";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="status-page">
      <section className="status-page__card">
        <div className="status-page__code" aria-hidden="true"><span>ERROR INTERNO</span><strong>500</strong></div>
        <div className="status-page__content">
          <span className="status-page__eyebrow"><AlertTriangle size={17} /> Algo no respondió como esperábamos</span>
          <h1>Tuvimos un problema procesando esta pantalla.</h1>
          <p>Podés reintentar de forma segura. Si estabas confirmando una compra o pago, verificá antes el estado del pedido para evitar repetir la operación.</p>
          <div className="status-page__actions">
            <button className="btn" type="button" onClick={reset}><RefreshCcw size={17} /> Reintentar</button>
            <Link className="btn btn--ghost" href="/"><Home size={17} /> Ir al inicio</Link>
          </div>
        </div>
      </section>
    </main>
  );
}