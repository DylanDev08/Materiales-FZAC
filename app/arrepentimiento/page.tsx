import Link from "next/link";
import Image from "next/image";
import { ConsumerRefundForm } from "@/components/legal/consumer-refund-form";
import { getEnv } from "@/lib/utils/env";
import { getWhatsAppHref } from "@/lib/utils/contact";

export default function Page() {
  const email = getEnv("FZAC_EMAIL") || "fortalezaconstruccionesrosario@gmail.com";
  const whatsappHref = getWhatsAppHref(
    "Hola FZAC, quiero iniciar una solicitud por botón de arrepentimiento. Tengo número de pedido, comprobante y datos de contacto."
  );
  const mailHref = `mailto:${email}?subject=${encodeURIComponent("Solicitud de botón de arrepentimiento")}&body=${encodeURIComponent(
    "Nombre y apellido:\nEmail:\nTeléfono:\nNúmero de pedido:\nMotivo:\nComentario:\n"
  )}`;

  return (
    <main className="page-section legal-page">
      <div className="container">
        <header className="legal-page__head">
          <span className="legal-page__logo">
            <Image src="/logoFZAC.jpg" alt="Materiales FZAC" width={76} height={76} priority />
          </span>
          <div>
            <span className="kicker">Derecho del consumidor</span>
            <h1>Botón de arrepentimiento</h1>
            <p>Canal directo para registrar y seguir una solicitud relacionada con una compra online.</p>
          </div>
        </header>
        <section>
          <p>
            Si realizaste una compra online en Materiales FZAC, podés solicitar la revocación de la compra dentro de los
            plazos legales aplicables. La solicitud se registra por los canales oficiales y FZAC confirma la recepción
            del trámite.
          </p>
          <p>
            Para iniciar el pedido, completá el formulario online. Si corresponde, después podés adjuntar fotos del
            producto y comprobante por WhatsApp o email indicando el número de trámite.
          </p>
          <ConsumerRefundForm />
          <div className="legal-action-row">
            <a className="btn legal-action-button" href={whatsappHref} target="_blank" rel="noreferrer">
              Consultar por WhatsApp
            </a>
            <a className="btn btn--ghost" href={mailHref}>
              Consultar por email
            </a>
            <Link className="btn btn--ghost" href="/cambios-y-devoluciones">
              Ver condiciones
            </Link>
          </div>
          <p className="notice">
            Revisión legal final recomendada por profesional. Esta pantalla facilita el acceso directo al derecho de
            arrepentimiento y no reemplaza asesoramiento legal.
          </p>
        </section>
      </div>
    </main>
  );
}
