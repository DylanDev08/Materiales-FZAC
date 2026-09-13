"use client";

import Link from "next/link";
import { AlertTriangle, Home, RefreshCcw } from "lucide-react";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="resilience-page">
      <div className="container resilience-page__layout resilience-page__layout--error">
        <div className="resilience-page__code" aria-hidden="true">
          <span>INTERRUPCIÓN TEMPORAL</span>
          <strong>!</strong>
          <i />
        </div>
        <div className="resilience-page__content">
          <span className="kicker"><AlertTriangle size={15} /> Algo no respondió como esperábamos</span>
          <h1>No perdimos tu obra.</h1>
          <p>Podés intentar nuevamente. Si el problema continúa, volvé al inicio; no mostramos datos técnicos ni información sensible.</p>
          <div className="resilience-page__actions">
            <button className="btn" type="button" onClick={reset}><RefreshCcw size={17} /> Reintentar</button>
            <Link className="btn btn--ghost" href="/"><Home size={17} /> Ir al inicio</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
