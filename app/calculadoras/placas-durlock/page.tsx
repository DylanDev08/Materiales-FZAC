import { JsonLd } from "@/components/seo/json-ld";
import { DurlockBoardCalculator } from "@/components/seo/durlock-board-calculator";
import { publicPageMetadata } from "@/lib/seo/metadata";
import { getPublicSiteUrl } from "@/lib/seo/site";

export const metadata = publicPageMetadata({
  title: "Calculadora de placas Durlock",
  description:
    "Calculá cuántas placas Durlock de 1,20 x 2,40 m necesitás según largo, alto, caras y margen de recorte. Calculadora gratuita de Materiales FZAC.",
  path: "/calculadoras/placas-durlock"
});

export default function Page() {
  const siteUrl = getPublicSiteUrl();
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Calculadora de placas Durlock",
    url: `${siteUrl}/calculadoras/placas-durlock`,
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Web",
    offers: { "@type": "Offer", price: 0, priceCurrency: "ARS" },
    description: "Calculadora orientativa para estimar placas Durlock de 1,20 x 2,40 m según superficie de pared."
  };

  return (
    <>
      <JsonLd data={schema} />
      <main className="help-page">
        <section className="help-page__hero">
          <div className="container help-page__hero-inner">
            <div>
              <span className="kicker">Herramienta gratuita · Materiales FZAC</span>
              <h1>Calculadora de placas Durlock</h1>
              <p>Ingresá las medidas de la pared y obtené una estimación rápida antes de armar tu pedido.</p>
            </div>
          </div>
        </section>
        <section className="page-section">
          <div className="container" style={{ maxWidth: 980 }}>
            <DurlockBoardCalculator />
          </div>
        </section>
      </main>
    </>
  );
}
