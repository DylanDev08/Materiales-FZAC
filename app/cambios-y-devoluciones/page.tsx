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

          <h2>Reembolso y seguimiento</h2>
          <p>
            Aprobar una solicitud no devuelve dinero automáticamente. FZAC valida la operación y, si corresponde,
            procesa el reembolso por el medio original. El sistema registra la decisión, impide duplicar una devolución y
            conserva el movimiento de stock y la auditoría administrativa.
          </p>
        </section>
      </div>
    </main>
  );
}
