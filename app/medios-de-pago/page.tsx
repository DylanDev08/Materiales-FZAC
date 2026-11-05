import { Banknote, MessageCircle, ShieldCheck } from "lucide-react";
import { publicPageMetadata } from "@/lib/seo/metadata";
import { getWhatsAppHref } from "@/lib/utils/contact";

export const metadata = publicPageMetadata({
  title: "Cómo pagar: coordinación por WhatsApp",
  description: "Armá tu pedido en Materiales FZAC y coordiná stock, transferencia y entrega por WhatsApp. No se cobra online.",
  path: "/medios-de-pago"
});

const methods = [
  {
    title: "Pedido por WhatsApp",
    text: "Generás una referencia desde el carrito y la enviás por WhatsApp. FZAC confirma disponibilidad, monto y entrega o retiro.",
    icon: MessageCircle
  },
  {
    title: "Transferencia bancaria",
    text: "Recibís los datos bancarios por WhatsApp y enviás el comprobante en la misma conversación. FZAC verifica la acreditación antes de preparar el pedido.",
    icon: Banknote
  }
];

export default function Page() {
  const whatsappHref = getWhatsAppHref(
    "Hola FZAC, quiero consultar los datos para transferencia de un pedido del e-commerce."
  );

  return (
    <main className="page-section payment-page">
      <div className="container">
        <span className="kicker">Compra coordinada</span>
        <h1>Confirmá el pedido y coordiná el pago por WhatsApp</h1>
        <p className="payment-page__lead">
          No realizamos cobros online ni pagos contra entrega. Armá tu carrito, confirmá el pedido
          y coordiná la transferencia y la entrega o retiro directamente con FZAC.
        </p>

        <section className="payment-method-grid">
          {methods.map((method) => {
            const Icon = method.icon;
            return (
              <article className="payment-method-card" key={method.title}>
                <Icon size={28} />
                <h2>{method.title}</h2>
                <p>{method.text}</p>
              </article>
            );
          })}
        </section>

        <section className="payment-transfer-panel">
          <div>
            <span className="kicker">Transferencias</span>
            <h2>La transferencia se confirma por WhatsApp</h2>
            <p>
              Te compartimos los datos bancarios después de confirmar disponibilidad y monto.
              Transferís y enviás el comprobante en esa misma conversación.
            </p>
          </div>
          <div className="payment-transfer-panel__steps">
            <span>1. Generás el pedido</span>
            <span>2. Confirmamos stock y monto</span>
            <span>3. Recibís los datos bancarios</span>
            <span>4. Enviás el comprobante por WhatsApp</span>
          </div>
          <a className="btn" href={whatsappHref} target="_blank" rel="noreferrer">
            <MessageCircle size={17} /> Consultar transferencia
          </a>
          <p><ShieldCheck size={16} /> No ingresás datos de tarjeta en la web.</p>
        </section>
      </div>
    </main>
  );
}
