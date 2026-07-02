import Link from "next/link";
import { CheckCircle, CreditCard, Package, Truck } from "lucide-react";

const steps = [
  { title: "Elegis productos", text: "Busca por rubro, marca, SKU o uso y agrega cantidades al carrito.", icon: Package },
  { title: "Confirmas datos", text: "Cargas comprador, telefono y retiro o envio coordinado.", icon: Truck },
  { title: "Pagas seguro", text: "FZAC no guarda tarjetas. Mercado Pago procesa los medios habilitados.", icon: CreditCard },
  { title: "Recibis confirmacion", text: "Con pago aprobado se descuenta stock, se emite ticket y se prepara la orden.", icon: CheckCircle }
];

export default function Page() {
  return (
    <main className="page-section payment-page">
      <div className="container">
        <span className="kicker">Como comprar</span>
        <h1>Compra materiales FZAC en pocos pasos</h1>
        <p className="payment-page__lead">
          El flujo esta armado para comprar como en un corralon real: stock validado, pago por proveedor externo,
          retiro o envio coordinado y seguimiento administrativo.
        </p>
        <section className="payment-method-grid">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <article className="payment-method-card" key={step.title}>
                <Icon size={28} />
                <h2>{step.title}</h2>
                <p>{step.text}</p>
              </article>
            );
          })}
        </section>
        <div className="banner-band" style={{ marginTop: 18 }}>
          <div>
            <span className="kicker">Atencion comercial</span>
            <h2>Necesitas ayuda antes de pagar?</h2>
            <p>Consultanos por WhatsApp para stock, unidad de venta, retiro, envio o pedidos especiales.</p>
          </div>
          <Link className="btn" href="/contacto">
            Contactar FZAC
          </Link>
        </div>
      </div>
    </main>
  );
}
