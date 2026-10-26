import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { publicPageMetadata } from "@/lib/seo/metadata";

export const metadata = publicPageMetadata({
  title: "Guías de materiales y construcción",
  description:
    "Guías prácticas de Materiales FZAC para elegir materiales, calcular compras y resolver dudas de construcción en seco, impermeabilización y obra.",
  path: "/guias"
});

const guides = [
  {
    title: "Qué materiales necesito para una pared de Durlock",
    description: "Placas, montantes, soleras, tornillos, cinta, masilla y aislación para armar una pared en seco.",
    href: "/guias/materiales-pared-durlock"
  }
];

export default function Page() {
  return (
    <main className="help-page">
      <section className="help-page__hero">
        <div className="container help-page__hero-inner">
          <div>
            <span className="kicker">Centro de conocimiento FZAC</span>
            <h1>Guías de materiales y construcción</h1>
            <p>Contenido práctico para entender qué comprar y llegar al pedido con una lista más clara.</p>
          </div>
        </div>
      </section>

      <section className="page-section">
        <div className="container">
          <div className="payment-method-grid">
            {guides.map((guide) => (
              <article className="payment-method-card" key={guide.href}>
                <BookOpen size={26} />
                <h2>{guide.title}</h2>
                <p>{guide.description}</p>
                <Link className="btn btn--ghost" href={guide.href}>
                  Leer guía <ArrowRight size={16} />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
