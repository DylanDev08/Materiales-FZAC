import Link from "next/link";
import { ArrowRight, CheckCircle2, MessageCircle } from "lucide-react";
import { JsonLd } from "@/components/seo/json-ld";
import { publicPageMetadata } from "@/lib/seo/metadata";
import { getPublicSiteUrl } from "@/lib/seo/site";
import { getWhatsAppHref } from "@/lib/utils/contact";

export const metadata = publicPageMetadata({
  title: "Qué materiales se usan en Steel Framing",
  description:
    "Guía práctica de materiales para Steel Framing: perfiles PGC y PGU, placas, barreras, aislación, fijaciones y terminaciones. Materiales FZAC Rosario.",
  path: "/guias/materiales-steel-framing"
});

const materials = [
  {
    title: "Perfiles PGC y PGU",
    text: "Forman la estructura del sistema. La sección, espesor y separación dependen del diseño y de las cargas del proyecto.",
    href: "/categoria/steel-framing"
  },
  {
    title: "Placas exteriores e interiores",
    text: "El cerramiento se completa con placas adecuadas para cada cara y condición de exposición, respetando el sistema proyectado.",
    href: "/productos?search=superboard"
  },
  {
    title: "Barreras y aislación",
    text: "Membranas y aislantes ayudan a controlar agua, aire, temperatura y acústica según la composición elegida.",
    href: "/productos?search=barrera"
  },
  {
    title: "Tornillos y fijaciones",
    text: "Cada unión requiere fijaciones compatibles con perfilería, placas y accesorios del sistema.",
    href: "/categoria/ferreteria"
  }
];

export default function Page() {
  const siteUrl = getPublicSiteUrl();
  const whatsapp = getWhatsAppHref(
    "Hola FZAC, estoy armando un proyecto de Steel Framing y necesito consultar materiales y cantidades."
  );
  const schema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "Qué materiales se usan en Steel Framing",
    mainEntityOfPage: `${siteUrl}/guias/materiales-steel-framing`,
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
              <span className="kicker">Guía FZAC · Steel Framing</span>
              <h1>Qué materiales se usan en Steel Framing</h1>
              <p>Un sistema Steel Framing combina estructura, placas, barreras, aislación y fijaciones. La lista exacta depende del proyecto y del detalle constructivo.</p>
            </div>
          </div>
        </section>

        <section className="page-section">
          <div className="container">
            <div className="payment-method-grid">
              {materials.map((material) => (
                <article className="payment-method-card" key={material.title}>
                  <CheckCircle2 size={24} />
                  <h2>{material.title}</h2>
                  <p>{material.text}</p>
                  <Link className="btn btn--ghost" href={material.href}>
                    Ver materiales <ArrowRight size={15} />
                  </Link>
                </article>
              ))}
            </div>

            <div className="legal-page__content" style={{ maxWidth: 920, marginTop: 34 }}>
              <h2>El cómputo depende del proyecto</h2>
              <p>
                No conviene estimar perfiles o placas solamente por metros cuadrados. Aberturas, cargas, modulación,
                encuentros, cantidad de niveles y revestimientos cambian el consumo. Para una compra precisa necesitás
                trabajar sobre planos o medidas reales.
              </p>
              <div className="legal-action-row">
                <Link className="btn" href="/categoria/steel-framing">
                  Ver Steel Framing <ArrowRight size={17} />
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
