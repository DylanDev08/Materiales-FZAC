import Link from "next/link";
import { ArrowRight, CheckCircle2, MessageCircle } from "lucide-react";
import { JsonLd } from "@/components/seo/json-ld";
import { publicPageMetadata } from "@/lib/seo/metadata";
import { getPublicSiteUrl } from "@/lib/seo/site";
import { getWhatsAppHref } from "@/lib/utils/contact";

export const metadata = publicPageMetadata({
  title: "Placa Durlock estándar, verde o roja: diferencias",
  description:
    "Conocé las diferencias entre placa Durlock estándar, resistente a humedad y resistente al fuego. Guía de Materiales FZAC en Rosario.",
  path: "/guias/placa-durlock-estandar-verde-roja"
});

const options = [
  {
    title: "Placa estándar",
    text: "Es la opción habitual para interiores secos, divisiones y cielorrasos donde no hay exigencias particulares de humedad o fuego.",
    href: "/productos?search=placa+durlock+12%2C5"
  },
  {
    title: "Placa resistente a humedad",
    text: "Se utiliza en ambientes donde existe humedad ambiental o condiciones que requieren una placa específica para ese uso. Siempre hay que respetar las recomendaciones del sistema.",
    href: "/productos?search=placa+verde"
  },
  {
    title: "Placa resistente al fuego",
    text: "Está pensada para soluciones que requieren un comportamiento específico frente al fuego y debe formar parte de un sistema correctamente diseñado.",
    href: "/productos?search=placa+roja"
  }
];

export default function Page() {
  const siteUrl = getPublicSiteUrl();
  const whatsapp = getWhatsAppHref(
    "Hola FZAC, necesito elegir entre placa Durlock estándar, verde o roja para mi obra."
  );
  const schema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "Placa Durlock estándar, verde o roja: diferencias",
    mainEntityOfPage: `${siteUrl}/guias/placa-durlock-estandar-verde-roja`,
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
              <span className="kicker">Guía FZAC · Durlock</span>
              <h1>Placa Durlock estándar, verde o roja: cuál elegir</h1>
              <p>El color identifica distintos tipos de placa, pero la elección correcta depende del ambiente y del sistema completo.</p>
            </div>
          </div>
        </section>
        <section className="page-section">
          <div className="container">
            <div className="payment-method-grid">
              {options.map((option) => (
                <article className="payment-method-card" key={option.title}>
                  <CheckCircle2 size={24} />
                  <h2>{option.title}</h2>
                  <p>{option.text}</p>
                  <Link className="btn btn--ghost" href={option.href}>Ver productos <ArrowRight size={15} /></Link>
                </article>
              ))}
            </div>
            <div className="legal-page__content" style={{ maxWidth: 900, marginTop: 32 }}>
              <h2>No elijas solamente por color</h2>
              <p>
                Además del tipo de placa, revisá espesor, medida, perfilería, cantidad de capas y condiciones reales de la obra.
                Para soluciones con requisitos técnicos específicos conviene seguir la ficha del fabricante y el diseño del sistema.
              </p>
              <div className="legal-action-row">
                <Link className="btn" href="/categoria/construccion-en-seco">Ver construcción en seco <ArrowRight size={17} /></Link>
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
