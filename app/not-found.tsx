import Link from "next/link";
import { ArrowRight, Home, Search, TriangleAlert } from "lucide-react";

export default function NotFound() {
  return (
    <main className="resilience-page">
      <div className="container resilience-page__layout">
        <div className="resilience-page__code" aria-hidden="true">
          <span>ERROR DE RUTA</span>
          <strong>404</strong>
          <i />
        </div>
        <div className="resilience-page__content">
          <span className="kicker"><TriangleAlert size={15} /> Esta dirección no existe</span>
          <h1>La obra sigue.<br />Busquemos otra ruta.</h1>
          <p>Es posible que el enlace haya cambiado. Podés volver al inicio o buscar directamente el material que necesitás.</p>
          <form className="resilience-search" action="/productos" method="get" role="search">
            <Search size={19} aria-hidden="true" />
            <label className="sr-only" htmlFor="not-found-search">Buscar productos</label>
            <input id="not-found-search" name="search" type="search" placeholder="Ej. placa, tornillo, perfil..." maxLength={80} />
            <button type="submit" aria-label="Buscar en el catálogo"><ArrowRight size={19} /></button>
          </form>
          <div className="resilience-page__actions">
            <Link className="btn" href="/"><Home size={17} /> Volver al inicio</Link>
            <Link className="btn btn--ghost" href="/productos">Explorar productos</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
