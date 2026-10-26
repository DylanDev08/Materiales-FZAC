import Link from "next/link";
import { ArrowRight, CheckCircle2, MessageCircle } from "lucide-react";
import { JsonLd } from "@/components/seo/json-ld";
import { publicPageMetadata } from "@/lib/seo/metadata";
import { getPublicSiteUrl } from "@/lib/seo/site";
import { getWhatsAppHref } from "@/lib/utils/contact";

export const metadata = publicPageMetadata({
  title: "Qué materiales necesito para una pared de Durlock",
  description:
    "Guía práctica para saber qué materiales se usan en una pared de Durlock: placas, montantes, soleras, tornillos, cinta, masilla y aislación. Materiales FZAC Rosario.",
  path: "/guias/materiales-pared-durlock"
});

const materials = [
  {
    name: "Placas de yeso",
    text: "Forman las caras de la pared. La elección depende del ambiente: estándar, resistente a humedad, resistente al fuego u otras variantes.",
    href: "/productos?search=placa+durlock"
  },
  {
    name: "Montantes",
    text: "Perfiles verticales que forman la estructura interior. La medida se elige según el espesor y las necesidades de la pared.",
    href: "/productos?search=montante"
  },
  {
    name: "Soleras",
    text: "Perfiles horizontales que fijan la estructura al piso y al cielorraso y reciben los montantes.",
    href: "/productos?search=solera"
  },
  {
    name: "Tornillos",
    text: "Se utilizan para fijar placas y perfilería. El tipo y largo dependen del sistema y de las capas de placa.",
    href: "/categoria/ferreteria"
  },
  {
    name: "Cinta y masilla",
    text: "Permiten tomar juntas, cubrir fijaciones y dejar la superficie preparada para la terminación.",
    href: "/productos?search=masilla+cinta"
  },
  {
    name: "Aislación",
    text: "Lana de vidrio u otros materiales pueden incorporarse dentro de la pared para mejorar comportamiento térmico y acústico.",
    href: "/productos?search=lana+vidrio"
  }
];

export default function Page() {
  const siteUrl = getPublicSiteUrl();
  const whatsapp = getWhatsAppHref(
    "Hola FZAC, quiero calcular los materiales para una pared de Durlock. ¿Me ayudan con cantidades y productos?"
  );

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "Qué materiales necesito para una pared de Durlock",
    description:
      "Guía práctica de los materiales principales para construir una pared de Durlock y cómo pedirlos en Materiales FZAC.",
    mainEntityOfPage: `${siteUrl}/guias/materiales-pared-durlock`,
    author: { "@id": `${siteUrl}/#store` },
    publisher: { "@id": `${siteUrl}/#store` },
    inLanguage: "es-AR"
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Inicio", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Guías", item: `${siteUrl}/guias` },
      {
        "@type": "ListItem",
        position: 3,
        name: "Materiales para pared de Durlock",
        item: `${siteUrl}/guias/materiales-pared-durlock`
      }
    ]
  };

  return (
    <>
      <JsonLd data={[articleSchema, breadcrumbSchema]} />
      <main className="help-page">
        <section className="help-page__hero">
          <div className="container help-page__hero-inner">
            <div>
              <span className="kicker">Guía FZAC · Construcción en seco</span>
              <h1>Qué materiales necesito para una pared de Durlock</h1>
              <p>
                Una pared en seco no es solamente placa: necesita estructura, fijaciones y materiales de terminación.
                Esta guía te ayuda a armar una lista base antes de calcular cantidades.
              </p>
            </div>
          </div>
        </section>

        <section className="page-section">
          <div className="container">
            <div className="legal-page__content" style={{ maxWidth: 920 }}>
              <h2>Materiales principales</h2>
              <p>
                La cantidad final depende del ancho y alto de la pared, cantidad de caras, separación entre perfiles,
                aberturas, aislación y tipo de placa. Por eso conviene tomar medidas antes de cerrar el pedido.
              </p>

              <div className="payment-method-grid" style={{ marginTop: 24 }}>
                {materials.map((material) => (
                  <article className="payment-method-card" key={material.name}>
                    <CheckCircle2 size={24} />
                    <h3>{material.name}</h3>
                    <p>{material.text}</p>
                    <Link href={material.href} className="account-security-note__actions">
                      Ver productos <ArrowRight size={15} />
                    </Link>
                  </article>
                ))}
              </div>

              <h2 style={{ marginTop: 36 }}>Antes de comprar</h2>
              <p>
                Medí largo y alto de la pared, definí si llevará placa en una o ambas caras, verificá si hay humedad o
                requisitos especiales y considerá puertas, ventanas o refuerzos. Con esos datos se puede estimar mejor
                la cantidad de placas, perfiles y consumibles.
              </p>

              <h2>¿Placa estándar, verde o resistente al fuego?</h2>
              <p>
                La placa estándar se usa en ambientes interiores secos. Para zonas con humedad se utilizan placas
                específicas resistentes a humedad, y para situaciones con requerimientos particulares de resistencia
                al fuego existen placas diseñadas para ese uso. La elección debe acompañar las condiciones reales de la obra.
              </p>

              <div className="legal-action-row" style={{ marginTop: 28 }}>
                <Link className="btn" href="/categoria/construccion-en-seco">
                  Ver materiales para Durlock <ArrowRight size={17} />
                </Link>
                <a className="btn btn--ghost" href={whatsapp} target="_blank" rel="noreferrer">
                  <MessageCircle size={17} /> Consultar cantidades por WhatsApp
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
