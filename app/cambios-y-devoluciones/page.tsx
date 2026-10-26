import Image from "next/image";
import Link from "next/link";
import { publicPageMetadata } from "@/lib/seo/metadata";
import { getWhatsAppHref } from "@/lib/utils/contact";

export const metadata = publicPageMetadata({
  title: "Cambios y devoluciones",
  description: "Información sobre cambios, devoluciones, garantía y derecho de arrepentimiento en Materiales FZAC.",
  path: "/cambios-y-devoluciones"
});

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
            El consumidor final puede revocar una compra realizada a distancia dentro de los diez (10) días computados
            desde la celebración del contrato o desde la entrega si esta fuera posterior. El trámite es gratuito y puede
            iniciarse sin registración previa.
          </p>
          <p>
            El número de pedido es opcional al iniciar. FZAC entrega un código de identificación y puede solicitar después
            datos razonables para verificar la identidad, vincular la operación y coordinar la restitución.
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
            Conservá embalaje, accesorios y comprobantes cuando existan. La apertura o revisión razonable no excluye por
            sí sola el derecho. El uso efectivo, consumo, instalación, mezcla, corte, deterioro imputable o pérdida de
            trazabilidad pueden modificar la procedencia según la naturaleza del material y la normativa aplicable.
          </p>

          <h2>Excepciones legales</h2>
          <p>
            Pueden quedar exceptuados los productos personalizados o preparados a pedido, las piezas cortadas según
            indicaciones del cliente, los bienes que no puedan devolverse por su naturaleza o se deterioren rápidamente,
            los productos efectivamente usados o consumidos y las compras destinadas a reventa o integración productiva.
            No se aplican exclusiones automáticas por el solo hecho de tratarse de un material de obra.
          </p>

          <h2>Reclamos por entrega</h2>
          <p>
            Revisar la mercadería al recibirla y dejar constancia de daños visibles facilita una solución rápida. La firma
            del remito no implica renunciar a reclamos por defectos ocultos, garantías ni otros derechos legales. Los
            bienes muebles no consumibles nuevos cuentan con la garantía legal aplicable.
          </p>

          <h2>Cómo solicitar un cambio o devolución</h2>
          <p>
            Podés iniciar la solicitud desde el botón de arrepentimiento, el formulario online o por los canales de contacto
            publicados. FZAC identifica el pedido, revisa el motivo y coordina la entrega, retiro o puesta a disposición de
            la mercadería según corresponda.
          </p>

          <h2>Plazos y costos</h2>
          <p>
            El derecho de arrepentimiento de compras a distancia puede ejercerse dentro de los diez (10) días indicados arriba.
            Cuando el derecho de arrepentimiento resulte procedente, su ejercicio no genera gastos para el consumidor. En otros
            cambios o devoluciones, cualquier costo de traslado aplicable se informa antes de coordinarlo y se determina según
            la causa del reclamo, el estado del producto y la normativa vigente.
          </p>

          <h2>Reembolso y seguimiento</h2>
          <p>
            Una solicitud aprobada no implica que el dinero se acredite de forma instantánea. FZAC verifica el pedido y el
            pago efectivamente recibido y, cuando corresponde, coordina la devolución por el mismo medio utilizado o por un
            medio acordado con el cliente. El plazo de acreditación puede depender de la entidad financiera o del medio de pago.
          </p>
          <p>
            FZAC conserva el código del trámite y la decisión administrativa para evitar duplicaciones y permitir el seguimiento
            de la solicitud. Si necesitás consultar un estado, podés hacerlo informando ese código por WhatsApp o email.
          </p>
        </section>
      </div>
    </main>
  );
}
