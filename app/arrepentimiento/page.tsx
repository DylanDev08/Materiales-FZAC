import Link from "next/link";
import Image from "next/image";
import { ConsumerRefundForm } from "@/components/legal/consumer-refund-form";
import { publicPageMetadata } from "@/lib/seo/metadata";
import { getEnv } from "@/lib/utils/env";
import { getWhatsAppHref } from "@/lib/utils/contact";

export const metadata = publicPageMetadata({
  title: "Botón de arrepentimiento",
  description: "Iniciá una solicitud de arrepentimiento o revocación de compra en Materiales FZAC sin registro previo.",
  path: "/arrepentimiento"
});

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
            <p>Canal directo, gratuito y sin registro previo para revocar una compra online.</p>
          </div>
        </header>
        <section>
          <p>
            Si sos consumidor final y realizaste una compra online en Materiales FZAC, podés solicitar la revocación
            dentro de los diez (10) días computados desde la celebración del contrato o desde la entrega si esta fuera
            posterior. No necesitás iniciar sesión ni completar otro trámite previo.
          </p>
          <p>
            Al enviar el formulario recibís un código de identificación en pantalla y, si el email transaccional está
            disponible, una constancia por correo. FZAC debe informar ese código dentro de las 24 horas y coordinar los
            pasos necesarios para hacer efectiva la solicitud cuando corresponda.
          </p>
          <p>
            El formulario no exige número de pedido. Si lo tenés, ingresarlo ayuda a vincular la compra. No incluyas
            contraseñas, datos completos de tarjeta ni códigos de seguridad en los comentarios.
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
            Referencia vigente: Disposición 954/2025, Ley 24.240 y artículos 1110 a 1116 del Código Civil y Comercial.
            La procedencia se analiza según la naturaleza y el uso del producto, sin limitar derechos irrenunciables.
          </p>
        </section>
      </div>
    </main>
  );
}
