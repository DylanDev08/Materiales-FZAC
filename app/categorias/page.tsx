import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Brush,
  Cable,
  Construction,
  Droplets,
  Grid3X3,
  Hammer,
  Layers3,
  PackageSearch,
  PanelsTopLeft
} from "lucide-react";
import { getCategories } from "@/lib/db/catalog";

const categoryIcons = [Construction, PanelsTopLeft, Hammer, PackageSearch, Cable, Droplets, Brush, Layers3];

export default async function Page() {
  const categories = await getCategories();

  return (
    <main className="category-directory-page">
      <section className="category-directory-hero">
        <div className="container category-directory-hero__inner">
          <div>
            <span className="kicker">Rubros FZAC</span>
            <h1>Entrá por el trabajo que tenés que resolver</h1>
            <p>Elegí un rubro y encontrá materiales, herramientas y complementos sin recorrer una lista interminable.</p>
          </div>
          <Link className="btn" href="/productos">
            Ver todos los productos <ArrowRight size={17} />
          </Link>
        </div>
      </section>

      <section className="page-section category-directory">
        <div className="container">
          <header className="category-directory__head">
            <span>{categories.length} rubros disponibles</span>
            <small>Stock y precios se validan nuevamente al comprar</small>
          </header>
          {categories.length ? (
            <div className="category-directory__list">
              {categories.map((category, index) => {
              const Icon = categoryIcons[index % categoryIcons.length] ?? Grid3X3;
              return (
                <Link className="category-directory__row" href={`/categoria/${category.slug}`} key={category.id}>
                  <span className="category-directory__index">{String(index + 1).padStart(2, "0")}</span>
                  <span className="category-directory__visual">
                    {category.image_url ? (
                      <Image src={category.image_url} alt="" fill sizes="72px" />
                    ) : (
                      <Icon size={27} />
                    )}
                  </span>
                  <span className="category-directory__copy">
                    <strong>{category.name}</strong>
                    <small>{category.description || "Materiales y complementos seleccionados para este rubro."}</small>
                  </span>
                  <span className="category-directory__action">
                    Explorar <ArrowRight size={17} />
                  </span>
                </Link>
              );
              })}
            </div>
          ) : (
            <div className="category-directory__empty">
              <PackageSearch size={34} />
              <div>
                <h2>Los rubros todavía no están publicados</h2>
                <p>Podés explorar todos los productos disponibles o pedir ayuda para encontrar un material.</p>
              </div>
              <Link className="btn btn--ghost" href="/contacto?tema=productos">
                Buscar con ayuda <ArrowRight size={17} />
              </Link>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
