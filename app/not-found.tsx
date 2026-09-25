import Link from "next/link";
import { ArrowRight, Home, Search, TriangleAlert } from "lucide-react";

export default function NotFound() {
  return (
    <main className="status-page">
      <section className="status-page__card">
        <div className="status-page__code" aria-hidden="true"><span>RUTA NO ENCONTRADA</span><strong>404</strong></div>
        <div className="status-page__content">
          <span className="status-page__eyebrow"><TriangleAlert size={17} /> Esta dirección no existe</span>
          <h1>La obra sigue. Busquemos otra ruta.</h1>
          <p>El enlace pudo cambiar, el producto puede haberse despublicado o la dirección estar incompleta. No significa que la tienda esté caída.</p>
          <form className="resilience-search" action="/productos" method="get" role="search">
            <Search size={19} aria-hidden="true" />
            <label className="sr-only" htmlFor="not-found-search">Buscar productos</label>
            <input id="not-found-search" name="search" type="search" placeholder="Ej. placa, tornillo, perfil..." maxLength={80} />
            <button type="submit" aria-label="Buscar en el catálogo"><ArrowRight size={19} /></button>
          </form>
          <div className="status-page__actions">
            <Link className="btn" href="/"><Home size={17} /> Volver al inicio</Link>
            <Link className="btn btn--ghost" href="/productos">Explorar productos</Link>
          </div>
        </div>
      </section>
    </main>
  );
}