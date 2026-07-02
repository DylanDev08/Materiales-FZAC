import Link from "next/link";
import { Mail, MessageCircle, PackageCheck } from "lucide-react";
import { getEnv } from "@/lib/utils/env";

export default function Page() {
  const whatsapp = getEnv("FZAC_WHATSAPP") || getEnv("NEXT_PUBLIC_FZAC_WHATSAPP") || "+5493415847000";
  const email = getEnv("FZAC_EMAIL") || getEnv("NEXT_PUBLIC_FZAC_EMAIL") || "fortalezaconstruccionesrosario@gmail.com";
  const whatsappHref = `https://wa.me/${whatsapp.replace(/\D/g, "")}?text=Hola%20FZAC,%20quiero%20hacer%20una%20consulta`;

  return (
    <main className="page-section payment-page">
      <div className="container">
        <span className="kicker">Contacto</span>
        <h1>Hablemos de tu compra</h1>
        <p className="payment-page__lead">
          Contacto comercial para stock, presupuestos, retiro coordinado, envios y dudas sobre pedidos.
        </p>
        <section className="payment-method-grid">
          <article className="payment-method-card">
            <MessageCircle size={28} />
            <h2>WhatsApp</h2>
            <p>Respuesta comercial para consultas de productos, entrega y pedidos especiales.</p>
            <Link className="btn" href={whatsappHref} target="_blank">
              Consultar por WhatsApp
            </Link>
          </article>
          <article className="payment-method-card">
            <Mail size={28} />
            <h2>Email</h2>
            <p>{email}</p>
            <Link className="btn btn--ghost" href={`mailto:${email}`}>
              Enviar email
            </Link>
          </article>
          <article className="payment-method-card">
            <PackageCheck size={28} />
            <h2>Pedidos</h2>
            <p>Si ya compraste, ingresa a tu cuenta para revisar estados, tickets y conversaciones.</p>
            <Link className="btn btn--ghost" href="/cuenta/pedidos">
              Mis pedidos
            </Link>
          </article>
        </section>
      </div>
    </main>
  );
}
