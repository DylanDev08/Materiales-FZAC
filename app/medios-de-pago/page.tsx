import { Banknote, CreditCard, MessageCircle, ShieldCheck } from "lucide-react";
import { publicPageMetadata } from "@/lib/seo/metadata";
import { getWhatsAppHref } from "@/lib/utils/contact";

export const metadata = publicPageMetadata({
  title: "Medios de pago: Mercado Pago o transferencia",
  description: "Pagá online con Mercado Pago o por transferencia enviando el comprobante a FZAC por WhatsApp. No hay pago contra entrega.",
  path: "/medios-de-pago"
});

const methods = [
  {
    title: "Tarjeta online",
    text: "Pagás dentro del checkout seguro con Mercado Pago. FZAC no ve ni almacena los datos de tu tarjeta.",
    icon: CreditCard
  },
  {
    title: "Mercado Pago",
    text: "Podés continuar al entorno seguro de Mercado Pago para completar el pago con los medios habilitados por la plataforma.",
    icon: ShieldCheck
  },
  {
    title: "Transferencia bancaria",
    text: "Generás el pedido, realizás la transferencia y enviás el comprobante por WhatsApp. FZAC prepara el pedido cuando verifica la acreditación.",
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
        <span className="kicker">Pago seguro</span>
        <h1>Pagá online o por transferencia</h1>
        <p className="payment-page__lead">
          No trabajamos con pago contra entrega ni con pedidos sin medio de pago definido. Elegís Mercado Pago o
          transferencia bancaria desde el checkout.
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
            <h2>El comprobante se envía por WhatsApp</h2>
            <p>
              Al elegir transferencia generamos una referencia de pedido. Pedís los datos bancarios por WhatsApp,
              transferís el total indicado y enviás el comprobante en ese mismo chat.
            </p>
          </div>
          <div className="payment-transfer-panel__steps">
            <span>1. Generás el pedido</span>
            <span>2. Recibís los datos bancarios</span>
            <span>3. Transferís el total</span>
            <span>4. Enviás el comprobante por WhatsApp</span>
          </div>
          <a className="btn" href={whatsappHref} target="_blank" rel="noreferrer">
            <MessageCircle size={17} /> Consultar transferencia
          </a>
        </section>
      </div>
    </main>
  );
}
