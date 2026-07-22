import Link from "next/link";
import { ConsumerRefundForm } from "@/components/legal/consumer-refund-form";
import { getEnv } from "@/lib/utils/env";
import { getWhatsAppHref } from "@/lib/utils/contact";

export default function Page() {
  const email = getEnv("FZAC_EMAIL") || "fortalezaconstruccionesrosario@gmail.com";
  const whatsappHref = getWhatsAppHref(
    "Hola FZAC, quiero iniciar una solicitud por boton de arrepentimiento. Tengo numero de pedido, comprobante y datos de contacto."
  );
  const mailHref = `mailto:${email}?subject=${encodeURIComponent("Solicitud de boton de arrepentimiento")}&body=${encodeURIComponent(
    "Nombre y apellido:\nEmail:\nTelefono:\nNumero de pedido:\nMotivo:\nComentario:\n"
  )}`;

  return (
    <main className="page-section legal-page">
      <div className="container">
        <span className="kicker">Derecho del consumidor</span>
        <h1>Boton de arrepentimiento</h1>
        <section>
          <p>
            Si realizaste una compra online en Materiales FZAC, podes solicitar la revocacion de la compra dentro de los
            plazos legales aplicables. La solicitud se registra por los canales oficiales y FZAC confirma la recepcion
            del tramite.
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
            Revision legal final recomendada por profesional. Esta pantalla facilita el acceso directo al derecho de
            arrepentimiento y no reemplaza asesoramiento legal.
          </p>
        </section>
      </div>
    </main>
  );
}
