import Link from "next/link";
import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <main className="page-section">
      <div className="container empty-state">
        <div>
          <SearchX size={38} />
          <h1>Pagina no encontrada</h1>
          <p>La ruta solicitada no existe o fue movida.</p>
          <Link className="btn" href="/">
            Volver al inicio
          </Link>
        </div>
      </div>
    </main>
  );
}
