import Link from "next/link";
import { ArrowRight, CheckCircle2, MessageCircle } from "lucide-react";
import { JsonLd } from "@/components/seo/json-ld";
import { publicPageMetadata } from "@/lib/seo/metadata";
import { getPublicSiteUrl } from "@/lib/seo/site";
import { getWhatsAppHref } from "@/lib/utils/contact";

export const metadata = publicPageMetadata({
  title: "Membrana líquida para techo: qué tener en cuenta",
  description:
    "Guía para elegir membrana líquida e impermeabilizantes para techo: estado de la superficie, fisuras, aplicación y cantidad. Materiales FZAC Rosario.",
  path: "/guias/membrana-liquida-para-techo"
});

const checks = [
  "Revisar si existen grietas, juntas abiertas o filtraciones puntuales antes de aplicar.",
  "Confirmar que el producto sea compatible con el tipo y estado de la superficie.",
  "Respetar preparación, manos, tiempos de secado y rendimiento indicados por el fabricante.",
  "Calcular los metros cuadrados reales y contemplar el consumo indicado para la solución elegida."
];

export default function Page() {
  const siteUrl = getPublicSiteUrl();
  const whatsapp = getWhatsAppHref(
    "Hola FZAC, necesito una membrana o impermeabilizante para techo. Quiero consultar cuál me conviene."
  );
  const schema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "Membrana líquida para techo: qué tener en cuenta",
    mainEntityOfPage: `${siteUrl}/guias/membrana-liquida-para-techo`,
    author: { "@id": `${siteUrl}/#store` },
    publisher: { "@id": `${siteUrl}/#store` },
    inLanguage: "es-AR"
  };

  return (
    <>
      <JsonLd data={schema} />
      <main className="help-page">
        <section className="help-page__hero">
          <div className="container help-page__hero-inner">
            <div>
              <span className="kicker">Guía FZAC · Impermeabilización</span>
              <h1>Membrana líquida para techo: qué tener en cuenta antes de comprar</h1>
              <p>La mejor elección depende de la superficie, el problema existente y el sistema de aplicación, no solamente del tamaño del envase.</p>
            </div>
          </div>
        </section>
        <section className="page-section">
          <div className="container">
            <div className="legal-page__content" style={{ maxWidth: 920 }}>
              <h2>Antes de impermeabilizar</h2>
              <div className="payment-method-grid" style={{ marginTop: 20 }}>
                {checks.map((check) => (
                  <article className="payment-method-card" key={check}>
                    <CheckCircle2 size={23} />
                    <p>{check}</p>
                  </article>
                ))}
              </div>

              <h2 style={{ marginTop: 34 }}>¿Membrana líquida o reparación de grietas?</h2>
              <p>
                Si el techo tiene fisuras o juntas problemáticas, puede ser necesario tratarlas antes de aplicar el revestimiento impermeable.
                La membrana de terminación y los productos para grietas cumplen funciones distintas dentro de una reparación.
              </p>

              <h2>Calculá por superficie, no por intuición</h2>
              <p>
                Medí largo por ancho de cada sector y sumá la superficie total. Después compará ese dato con el rendimiento y número de manos indicados
                por el fabricante del producto elegido. Eso evita comprar de menos o asumir una cobertura que no corresponde.
              </p>

              <div className="legal-action-row">
                <Link className="btn" href="/categoria/pintura-impermeabilizacion">
                  Ver impermeabilizantes <ArrowRight size={17} />
                </Link>
                <a className="btn btn--ghost" href={whatsapp} target="_blank" rel="noreferrer">
                  <MessageCircle size={17} /> Consultar por WhatsApp
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
