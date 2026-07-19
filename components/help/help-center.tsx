"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bot, Boxes, CircleDollarSign, Mail, MessageCircle, PackageCheck, RotateCcw, Truck } from "lucide-react";
import { AssistantLauncher } from "@/components/chatbot/assistant-launcher";

const topics = [
  {
    id: "productos",
    title: "Elegir productos",
    short: "Materiales, medidas y equivalencias.",
    description: "El chatbot puede buscar productos reales, comparar alternativas y pedirte los datos mínimos para estimar cantidades.",
    prompt: "Necesito ayuda para elegir productos, medidas o una alternativa equivalente.",
    href: "/productos",
    hrefLabel: "Abrir catálogo",
    icon: Boxes
  },
  {
    id: "stock",
    title: "Stock y reposición",
    short: "Disponibilidad y cantidades.",
    description: "Consultá un producto y cantidad. La disponibilidad visible se vuelve a validar antes de crear el pedido.",
    prompt: "Quiero consultar stock y reposición de un producto.",
    href: "/productos?inStock=true",
    hrefLabel: "Ver productos con stock",
    icon: PackageCheck
  },
  {
    id: "entrega",
    title: "Entrega o retiro",
    short: "Dirección, distancia y coordinación.",
    description: "Indicá si retirás o necesitás entrega. Para cotizar envío se requiere una dirección completa y configuración vigente.",
    prompt: "Necesito resolver entrega o retiro de una compra.",
    href: "/envios-y-retiros",
    hrefLabel: "Ver condiciones de entrega",
    icon: Truck
  },
  {
    id: "pagos",
    title: "Pagos",
    short: "Mercado Pago, transferencia y coordinación.",
    description: "Revisá qué hace cada método, cuándo se confirma el pedido y por qué un pago puede quedar pendiente.",
    prompt: "Necesito ayuda con los medios de pago o un pago pendiente.",
    href: "/medios-de-pago",
    hrefLabel: "Ver medios de pago",
    icon: CircleDollarSign
  },
  {
    id: "pedidos",
    title: "Pedidos y comprobantes",
    short: "Seguimiento desde Mi cuenta.",
    description: "Si ya compraste, iniciá sesión para ver estados, productos, importes y comprobantes vinculados a tu cuenta.",
    prompt: "Quiero revisar el estado de mi pedido o encontrar el comprobante.",
    href: "/cuenta/pedidos",
    hrefLabel: "Ir a mis pedidos",
    icon: PackageCheck
  },
  {
    id: "devoluciones",
    title: "Cambios y devoluciones",
    short: "Requisitos y revisión del material.",
    description: "Conservá el comprobante y revisá las condiciones antes de iniciar una solicitud por producto incorrecto o dañado.",
    prompt: "Necesito revisar las condiciones para un cambio o devolución.",
    href: "/cambios-y-devoluciones",
    hrefLabel: "Ver política de cambios",
    icon: RotateCcw
  }
];

export function HelpCenter({ whatsappHref, email, initialTopic }: { whatsappHref: string; email: string; initialTopic?: string }) {
  const initialIndex = Math.max(0, topics.findIndex((topic) => topic.id === initialTopic));
  const [selectedId, setSelectedId] = useState(topics[initialIndex]?.id ?? topics[0].id);
  const selected = useMemo(() => topics.find((topic) => topic.id === selectedId) ?? topics[0], [selectedId]);
  const Icon = selected.icon;

  return (
    <section className="help-center">
      <nav className="help-center__topics" aria-label="Temas de ayuda">
        {topics.map((topic) => {
          const TopicIcon = topic.icon;
          return (
            <button type="button" className={selected.id === topic.id ? "is-active" : ""} onClick={() => setSelectedId(topic.id)} key={topic.id}>
              <TopicIcon size={20} />
              <span>
                <strong>{topic.title}</strong>
                <small>{topic.short}</small>
              </span>
              <ArrowRight size={16} />
            </button>
          );
        })}
      </nav>

      <article className="help-center__answer">
        <span className="help-center__icon"><Icon size={30} /></span>
        <span className="kicker">Resolución automática</span>
        <h2>{selected.title}</h2>
        <p>{selected.description}</p>
        <div className="help-center__answer-actions">
          <AssistantLauncher className="btn" prompt={selected.prompt}>
            <Bot size={18} /> Resolver con AI Chatbot FZAC
          </AssistantLauncher>
          <Link className="btn btn--ghost" href={selected.href}>
            {selected.hrefLabel} <ArrowRight size={16} />
          </Link>
        </div>
        <footer>
          <span>¿El caso requiere revisión humana?</span>
          <a href={whatsappHref} target="_blank" rel="noreferrer"><MessageCircle size={16} /> WhatsApp</a>
          <a href={`mailto:${email}`}><Mail size={16} /> Email</a>
        </footer>
      </article>
    </section>
  );
}
