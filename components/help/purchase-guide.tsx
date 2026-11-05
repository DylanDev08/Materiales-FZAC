"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, MessageCircle, PackageSearch, ShoppingCart, Truck } from "lucide-react";
import { AssistantLauncher } from "@/components/chatbot/assistant-launcher";

const steps = [
  {
    title: "Elegí materiales",
    short: "Buscá por rubro, marca o uso.",
    text: "Compará precio, unidad de venta y stock visible. Podés filtrar por rubro, marca, ofertas o disponibilidad.",
    details: ["Revisá la unidad de venta", "Sumá un margen razonable para obra", "Guardá todo en el carrito"],
    href: "/productos",
    action: "Explorar productos",
    prompt: "Quiero elegir materiales para una obra y necesito ayuda con productos y cantidades.",
    icon: PackageSearch
  },
  {
    title: "Revisá el carrito",
    short: "Confirmá productos y cantidades.",
    text: "Antes de avanzar podés subir o bajar cantidades. FZAC valida nuevamente precios y stock desde el servidor.",
    details: ["No se confía en precios del navegador", "El stock se valida al comprar", "Podés retirar productos del carrito"],
    href: "/carrito",
    action: "Ver carrito",
    prompt: "Necesito revisar mi carrito y confirmar si las cantidades son correctas.",
    icon: ShoppingCart
  },
  {
    title: "Confirmá por WhatsApp",
    short: "Pedido sin pago online.",
    text: "Confirmás el pedido en la web y abrís WhatsApp con la referencia para coordinar stock, datos de transferencia y entrega o retiro.",
    details: ["No se cobra desde la web", "FZAC confirma stock y el monto", "La transferencia se verifica antes de preparar el pedido"],
    href: "/medios-de-pago",
    action: "Cómo coordinamos el pago",
    prompt: "Quiero saber cómo confirmar un pedido y coordinar el pago por WhatsApp.",
    icon: MessageCircle
  },
  {
    title: "Seguí el pedido",
    short: "Estado, comprobante y preparación.",
    text: "Tu pedido queda registrado en Mi cuenta. Coordinás disponibilidad y transferencia por WhatsApp; FZAC confirma el pago antes de iniciar la preparación.",
    details: ["Conservá la referencia del pedido", "El pago requiere acreditación", "FZAC actualiza la preparación"],
    href: "/cuenta/pedidos",
    action: "Ver mis pedidos",
    prompt: "Quiero saber cómo seguir un pedido y dónde encontrar el comprobante.",
    icon: Truck
  }
];

export function PurchaseGuide() {
  const [active, setActive] = useState(0);
  const step = steps[active];
  const Icon = step.icon;

  return (
    <section className="purchase-guide" aria-label="Pasos para comprar">
      <nav className="purchase-guide__steps">
        {steps.map((item, index) => {
          const StepIcon = item.icon;
          return (
            <button className={active === index ? "is-active" : ""} type="button" onClick={() => setActive(index)} key={item.title}>
              <span>{index + 1}</span>
              <StepIcon size={19} />
              <strong>{item.title}</strong>
              <small>{item.short}</small>
            </button>
          );
        })}
      </nav>

      <article className="purchase-guide__detail">
        <div className="purchase-guide__visual">
          <span>{active + 1}</span>
          <Icon size={42} />
        </div>
        <div className="purchase-guide__copy">
          <span className="kicker">Paso {active + 1} de {steps.length}</span>
          <h2>{step.title}</h2>
          <p>{step.text}</p>
          <ul>
            {step.details.map((detail) => (
              <li key={detail}>
                <CheckCircle2 size={16} /> {detail}
              </li>
            ))}
          </ul>
        </div>
        <div className="purchase-guide__actions">
          <Link className="btn" href={step.href}>
            {step.action} <ArrowRight size={17} />
          </Link>
          <AssistantLauncher className="btn btn--ghost" prompt={step.prompt}>
            Preguntar al chatbot
          </AssistantLauncher>
        </div>
      </article>
    </section>
  );
}
