import { JsonLd } from "@/components/seo/json-ld";
import { PaintCalculator } from "@/components/seo/paint-calculator";
import { publicPageMetadata } from "@/lib/seo/metadata";
import { getPublicSiteUrl } from "@/lib/seo/site";

export const metadata = publicPageMetadata({
  title: "Calculadora de pintura por m²",
  description:
    "Calculá cuántos litros de pintura necesitás según superficie, cantidad de manos, rendimiento y margen adicional. Herramienta gratuita de Materiales FZAC.",
  path: "/calculadoras/pintura"
});

export default function Page() {
  const siteUrl = getPublicSiteUrl();
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Calculadora de pintura por m²",
    url: `${siteUrl}/calculadoras/pintura`,
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Web",
    offers: { "@type": "Offer", price: 0, priceCurrency: "ARS" },
    description: "Calculadora para estimar litros de pintura según superficie, manos y rendimiento."
  };

  return (
    <>
      <JsonLd data={schema} />
      <main className="help-page">
        <section className="help-page__hero">
          <div className="container help-page__hero-inner">
            <div>
              <span className="kicker">Herramienta gratuita · Materiales FZAC</span>
              <h1>Calculadora de pintura por m²</h1>
              <p>Estimá litros antes de comprar y contrastá siempre el resultado con el rendimiento indicado por la marca.</p>
            </div>
          </div>
        </section>
        <section className="page-section">
          <div className="container" style={{ maxWidth: 980 }}>
            <PaintCalculator />
          </div>
        </section>
      </main>
    </>
  );
}
