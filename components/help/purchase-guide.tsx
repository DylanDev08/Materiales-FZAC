"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, CreditCard, PackageSearch, ShoppingCart, Truck } from "lucide-react";
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
    title: "Elegí entrega y pago",
    short: "Retiro, envío o coordinación.",
    text: "Completá tus datos, elegí retiro o envío y seleccioná Mercado Pago, transferencia o coordinación por WhatsApp.",
    details: ["Retiro no exige dirección", "El envío requiere domicilio", "Cada método conserva su propio flujo"],
    href: "/medios-de-pago",
    action: "Ver medios de pago",
    prompt: "Quiero entender las opciones de entrega y los medios de pago antes de comprar.",
    icon: CreditCard
  },
  {
    title: "Seguí el pedido",
    short: "Estado, comprobante y preparación.",
    text: "Después de crear el pedido podés revisar su estado desde Mi cuenta. El stock se descuenta solo tras la confirmación correspondiente.",
    details: ["Pago pendiente no descuenta stock", "El comprobante aparece al confirmarse", "La preparación se actualiza desde FZAC"],
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
