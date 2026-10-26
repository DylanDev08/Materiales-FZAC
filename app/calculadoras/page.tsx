import Link from "next/link";
import { ArrowRight, Calculator } from "lucide-react";
import { publicPageMetadata } from "@/lib/seo/metadata";

export const metadata = publicPageMetadata({
  title: "Calculadoras de materiales para obra",
  description:
    "Calculadoras gratuitas de Materiales FZAC para estimar placas Durlock, pintura y membrana líquida antes de comprar.",
  path: "/calculadoras"
});

const calculators = [
  {
    title: "Calculadora de placas Durlock",
    description: "Estimá placas de 1,20 x 2,40 m según largo, alto, caras y margen de recorte.",
    href: "/calculadoras/placas-durlock"
  },
  {
    title: "Calculadora de pintura",
    description: "Estimá litros según superficie, cantidad de manos y rendimiento del producto.",
    href: "/calculadoras/pintura"
  },
  {
    title: "Calculadora de membrana líquida",
    description: "Estimá kilos de impermeabilizante según superficie y consumo recomendado.",
    href: "/calculadoras/membrana-liquida"
  }
];

export default function Page() {
  return (
    <main className="help-page">
      <section className="help-page__hero">
        <div className="container help-page__hero-inner">
          <div>
            <span className="kicker">Herramientas gratuitas FZAC</span>
            <h1>Calculadoras de materiales para obra</h1>
            <p>Hacé una estimación inicial y después compará el resultado con las fichas técnicas y condiciones reales de la obra.</p>
          </div>
        </div>
      </section>
      <section className="page-section">
        <div className="container">
          <div className="payment-method-grid">
            {calculators.map((calculator) => (
              <article className="payment-method-card" key={calculator.href}>
                <Calculator size={26} />
                <h2>{calculator.title}</h2>
                <p>{calculator.description}</p>
                <Link className="btn btn--ghost" href={calculator.href}>
                  Abrir calculadora <ArrowRight size={16} />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
