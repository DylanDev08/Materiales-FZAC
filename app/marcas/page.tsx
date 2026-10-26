import Link from "next/link";
import { ArrowRight, BadgeCheck } from "lucide-react";
import { BRAND_SEO } from "@/lib/seo/brand-content";
import { publicPageMetadata } from "@/lib/seo/metadata";

export const metadata = publicPageMetadata({
  title: "Marcas de materiales de construcción en Rosario",
  description: "Explorá marcas disponibles en Materiales FZAC: Durlock, Superboard, Fischer, ATENNEAS, Realis y FONAC con precios y SKU.",
  path: "/marcas"
});

export default function Page() {
  return (
    <main className="help-page">
      <section className="help-page__hero">
        <div className="container help-page__hero-inner">
          <div>
            <span className="kicker">Marcas disponibles en FZAC</span>
            <h1>Marcas de materiales de construcción en Rosario</h1>
            <p>Accedé directo a las marcas con mayor catálogo publicado y compará productos, precios, SKU y disponibilidad.</p>
          </div>
        </div>
      </section>

      <section className="page-section">
        <div className="container">
          <div className="payment-method-grid">
            {BRAND_SEO.map((item) => (
              <article className="payment-method-card" key={item.slug}>
                <BadgeCheck size={24} />
                <h2>{item.brand}</h2>
                <p>{item.intro}</p>
                <Link className="btn btn--ghost" href={`/marca/${item.slug}`}>
                  Ver productos <ArrowRight size={16} />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
