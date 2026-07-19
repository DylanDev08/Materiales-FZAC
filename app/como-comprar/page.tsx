import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { PurchaseGuide } from "@/components/help/purchase-guide";

export default function Page() {
  return (
    <main className="help-page">
      <section className="help-page__hero">
        <div className="container help-page__hero-inner">
          <div>
            <span className="kicker">Cómo comprar</span>
            <h1>De elegir el material a seguir el pedido, sin vueltas</h1>
            <p>Avanzá por cada etapa y revisá exactamente qué necesita FZAC para validar stock, pago y preparación.</p>
          </div>
          <span className="help-page__trust"><ShieldCheck size={20} /> Stock y total validados en servidor</span>
        </div>
      </section>
      <section className="page-section">
        <div className="container">
          <PurchaseGuide />
          <div className="help-page__next">
            <span>¿Ya sabés qué necesitás?</span>
            <Link className="btn" href="/productos">Empezar compra <ArrowRight size={17} /></Link>
          </div>
        </div>
      </section>
    </main>
  );
}
