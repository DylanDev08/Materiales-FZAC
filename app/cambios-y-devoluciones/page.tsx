import Image from "next/image";
import Link from "next/link";
import { getWhatsAppHref } from "@/lib/utils/contact";

export default function Page() {
  const refundHref = getWhatsAppHref(
    "Hola FZAC, quiero solicitar revisión o devolución de mercadería. Tengo comprobante/orden y puedo enviar fotos del producto."
  );

  return (
    <main className="page-section legal-page">
      <div className="container">
        <header className="legal-page__head">
          <span className="legal-page__logo">
            <Image src="/logoFZAC.jpg" alt="Materiales FZAC" width={76} height={76} priority />
          </span>
          <div>
            <span className="kicker">Derecho del consumidor</span>
            <h1>Cambios, devoluciones y botón de arrepentimiento</h1>
            <p>Condiciones generales y acceso al canal formal de solicitudes.</p>
          </div>
        </header>
        <section>
          <h2>Botón de arrepentimiento</h2>
          <p>
            El cliente puede revocar una compra realizada a distancia dentro de los diez (10) días corridos desde la
            entrega efectiva del producto o desde la celebración del contrato, conforme al Art. 34 de la Ley 24.240.
          </p>
          <p>
            Para iniciar el trámite debe conservar el comprobante y contactar a FZAC indicando orden, producto, cantidad,
            motivo, teléfono y dirección de retiro si corresponde. El equipo confirma los pasos por los canales oficiales.
          </p>
          <div className="legal-action-row">
            <Link className="btn legal-action-button" href="/arrepentimiento">
              Iniciar solicitud online
            </Link>
            <a className="btn btn--ghost" href={refundHref} target="_blank" rel="noreferrer">
              Consultar por WhatsApp
            </a>
          </div>

          <h2>Condición del producto</h2>
          <p>
            El producto debe estar intacto, sin uso, sin instalación, en embalaje original cerrado y con accesorios,
            manuales y comprobante. No se aceptan devoluciones de productos usados, instalados, cortados, mezclados,
            deteriorados o sin embalaje cuando corresponda.
          </p>

          <h2>Materiales excluidos</h2>
          <p>
            Por su naturaleza técnica y logística, quedan excluidos materiales a granel o fraccionados, áridos, arena,
            piedra, cemento, cal, productos despachados por peso/fraccion exacta, pinturas preparadas a pedido, piezas
            cortadas a medida y materiales deteriorados por humedad, mala estiba o exposición climática.
          </p>

          <h2>Reclamos por entrega</h2>
          <p>
            La mercadería debe revisarse antes de firmar remito. La firma implica conformidad sobre estado visible,
            integridad y cantidades. Para defectos ocultos o errores no visibles, el cliente dispone de cuarenta y ocho
            (48) horas hábiles desde la recepción para informar con fotos y copia del remito.
          </p>
        </section>
      </div>
    </main>
  );
}
