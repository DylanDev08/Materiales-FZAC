import { Banknote, MessageCircle, ShieldCheck } from "lucide-react";
import { publicPageMetadata } from "@/lib/seo/metadata";
import { getWhatsAppHref } from "@/lib/utils/contact";

export const metadata = publicPageMetadata({
  title: "Pagos coordinados por WhatsApp",
  description: "Generá tu pedido en Materiales FZAC y coordiná stock, pago, envío o retiro directamente por WhatsApp.",
  path: "/medios-de-pago"
});

const methods = [
  {
    title: "Pedido con referencia FZAC",
    text: "La web genera un código de pedido con los productos, cantidades y total estimado para que la conversación quede identificada.",
    icon: ShieldCheck
  },
  {
    title: "Coordinación por WhatsApp",
    text: "FZAC confirma disponibilidad, reposición, entrega o retiro y cualquier ajuste antes de cerrar la compra.",
    icon: MessageCircle
  },
  {
    title: "Pago coordinado",
    text: "Los datos y la modalidad de pago se informan durante la conversación de WhatsApp una vez revisado el pedido.",
    icon: Banknote
  }
];

export default function Page() {
  const whatsappHref = getWhatsAppHref("Hola FZAC, quiero consultar por un pedido de materiales y los medios de pago disponibles.");

  return (
    <main className="page-section payment-page">
      <div className="container">
        <span className="kicker">Compra asistida</span>
        <h1>Pedidos y pagos por WhatsApp</h1>
        <p className="payment-page__lead">
          Materiales FZAC no procesa pagos con tarjeta dentro de la web. Armás el carrito, generás la referencia del
          pedido y continuás por WhatsApp para confirmar stock, envío o retiro y el pago.
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
            <span className="kicker">Cómo funciona</span>
            <h2>Del carrito a WhatsApp</h2>
            <p>
              El pedido queda registrado con un código FZAC. Ese mismo código y el detalle de los materiales se envían
              en el mensaje de WhatsApp para continuar la coordinación sin volver a cargar todo.
            </p>
          </div>
          <div className="payment-transfer-panel__steps">
            <span>1. Armás el carrito</span>
            <span>2. Generás el pedido</span>
            <span>3. Confirmamos por WhatsApp</span>
            <span>4. Coordinamos pago y entrega</span>
          </div>
          <a className="btn" href={whatsappHref} target="_blank" rel="noreferrer">
            <MessageCircle size={17} /> Consultar por WhatsApp
          </a>
        </section>
      </div>
    </main>
  );
}
