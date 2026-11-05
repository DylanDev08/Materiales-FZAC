import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { PurchaseGuide } from "@/components/help/purchase-guide";
import { publicPageMetadata } from "@/lib/seo/metadata";

export const metadata = publicPageMetadata({
  title: "Cómo comprar materiales online",
  description: "Elegí materiales, armá tu carrito y coordiná el pedido, la transferencia y la entrega por WhatsApp.",
  path: "/como-comprar"
});

export default function Page() {
  return (
    <main className="help-page">
      <section className="help-page__hero">
        <div className="container help-page__hero-inner">
          <div>
            <span className="kicker">Cómo comprar</span>
            <h1>De elegir el material a seguir el pedido, sin vueltas</h1>
            <p>Armá el carrito, revisá el total y confirmá el pedido. FZAC coordina stock, transferencia y entrega o retiro por WhatsApp.</p>
          </div>
          <span className="help-page__trust"><ShieldCheck size={20} /> Pedido coordinado por WhatsApp</span>
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
