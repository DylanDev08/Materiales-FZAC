import { JsonLd } from "@/components/seo/json-ld";
import { MembraneCalculator } from "@/components/seo/membrane-calculator";
import { publicPageMetadata } from "@/lib/seo/metadata";
import { getPublicSiteUrl } from "@/lib/seo/site";

export const metadata = publicPageMetadata({
  title: "Calculadora de membrana líquida para techo",
  description:
    "Calculá cuántos kilos de membrana líquida necesitás según los metros cuadrados del techo y el consumo indicado por el fabricante. Materiales FZAC.",
  path: "/calculadoras/membrana-liquida"
});

export default function Page() {
  const siteUrl = getPublicSiteUrl();
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Calculadora de membrana líquida",
    url: `${siteUrl}/calculadoras/membrana-liquida`,
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Web",
    offers: { "@type": "Offer", price: 0, priceCurrency: "ARS" },
    description: "Calculadora orientativa para estimar kilos de membrana líquida según superficie y consumo."
  };

  return (
    <>
      <JsonLd data={schema} />
      <main className="help-page">
        <section className="help-page__hero">
          <div className="container help-page__hero-inner">
            <div>
              <span className="kicker">Herramienta gratuita · Materiales FZAC</span>
              <h1>Calculadora de membrana líquida para techo</h1>
              <p>Estimá la cantidad total a partir de la superficie y el consumo recomendado para el producto elegido.</p>
            </div>
          </div>
        </section>
        <section className="page-section">
          <div className="container" style={{ maxWidth: 980 }}>
            <MembraneCalculator />
          </div>
        </section>
      </main>
    </>
  );
}
