import Image from "next/image";
import Link from "next/link";
import { LegalIdentity } from "@/components/legal/legal-identity";
import { publicPageMetadata } from "@/lib/seo/metadata";

export const metadata = publicPageMetadata({
  title: "Términos y condiciones",
  description: "Condiciones de compra, entrega, pago, garantía y arrepentimiento de Materiales FZAC.",
  path: "/terminos"
});

export default function Page() {
  return (
    <main className="page-section legal-page">
      <div className="container">
        <header className="legal-page__head">
          <span className="legal-page__logo">
            <Image src="/logoFZAC.jpg" alt="Materiales FZAC" width={76} height={76} priority />
          </span>
          <div>
            <span className="kicker">Legal FZAC</span>
            <h1>Términos y condiciones</h1>
            <p>Versión vigente desde el 11 de agosto de 2026. Leé estas condiciones antes de confirmar una compra.</p>
          </div>
        </header>

        <nav className="legal-page__actions" aria-label="Acciones legales">
          <Link className="btn" href="/productos">Ver productos</Link>
          <Link className="btn btn--ghost" href="/privacidad">Política de privacidad</Link>
          <Link className="btn btn--ghost" href="/arrepentimiento">Botón de arrepentimiento</Link>
        </nav>

        <section>
          <h2>1. Identificación y contacto del proveedor</h2>
          <LegalIdentity />

          <h2>2. Alcance y aceptación</h2>
          <p>
            Estas condiciones regulan las compras realizadas a distancia en Materiales FZAC. Antes de confirmar,
            el checkout permite revisar y corregir productos, cantidades, datos de contacto, forma de entrega, medio de
            pago y total. La aceptación se registra de forma expresa; el silencio nunca se considera consentimiento.
          </p>
          <p>
            La confirmación electrónica del pedido acredita su recepción, pero no reemplaza la aprobación del pago ni
            la validación final de stock cuando corresponda.
          </p>

          <h2>3. Catálogo, disponibilidad y precios</h2>
          <p>
            Las características esenciales, unidad de venta, precio y disponibilidad se informan en cada producto. El
            total definitivo, incluidos los costos adicionales informados, se muestra antes de confirmar la operación.
            Si hubiera un error material de publicación o una falta real de stock, FZAC lo comunicará y ofrecerá las
            alternativas legales disponibles, incluida la restitución de lo pagado cuando corresponda.
          </p>

          <h2>4. Pagos y comprobantes</h2>
          <p>
            Los pagos online son procesados por proveedores habilitados. FZAC no solicita ni almacena el número completo
            de tarjeta, vencimiento ni código de seguridad. El stock se descuenta y el comprobante interno se emite
            únicamente después de una confirmación válida del pago o de la aprobación administrativa aplicable.
          </p>
          <p>
            El comprobante interno FZAC documenta el pedido y el pago, pero no debe interpretarse como factura fiscal.
            La documentación fiscal se emitirá por el medio habilitado cuando corresponda.
          </p>

          <h2>5. Entrega y retiro</h2>
          <p>
            La modalidad, dirección y costo de entrega se informan antes de confirmar. En el retiro, la persona autorizada
            debe acreditar los datos del pedido. Al recibir mercadería conviene revisar cantidades y daños visibles y
            dejar constancia inmediata, sin que la firma del remito implique renunciar a garantías, reclamos por defectos
            ocultos ni otros derechos legales.
          </p>
          <p>
            Si la descarga no puede realizarse por ausencia de receptor, falta de acceso seguro u otra circunstancia
            ajena a FZAC, se coordinará una nueva entrega y cualquier costo adicional deberá ser informado y aceptado.
          </p>

          <h2>6. Derecho de arrepentimiento</h2>
          <p>
            En las compras a distancia, el consumidor final puede revocar la aceptación dentro de los diez (10) días
            computados desde la celebración del contrato o desde la entrega si esta fuera posterior. El derecho es
            irrenunciable y su ejercicio en tiempo y forma no genera gastos para el consumidor.
          </p>
          <p>
            El <Link href="/arrepentimiento">Botón de arrepentimiento</Link> está disponible sin registro previo. Al
            enviar la solicitud se entrega un código de trámite por el mismo medio, dentro del plazo legal de 24 horas.
            FZAC coordinará la puesta a disposición o retiro de la mercadería cuando corresponda.
          </p>

          <h2>7. Excepciones legales y estado de la mercadería</h2>
          <p>
            Las excepciones se evalúan de acuerdo con el artículo 1116 del Código Civil y Comercial y la Disposición
            954/2025. Pueden comprender productos personalizados o cortados según indicaciones del cliente, bienes que
            no puedan devolverse por su naturaleza o se deterioren rápidamente, productos efectivamente utilizados o
            consumidos y adquisiciones destinadas a reventa o integración en procesos productivos.
          </p>
          <p>
            La sola apertura del embalaje o una revisión razonable no se utilizarán como exclusión automática. Cada caso
            se resolverá según la naturaleza del material, su trazabilidad, uso, conservación y las normas aplicables.
          </p>

          <h2>8. Garantía legal y reclamos</h2>
          <p>
            Los bienes muebles no consumibles nuevos tienen garantía legal de seis (6) meses desde la entrega, sin
            perjuicio de plazos mayores ofrecidos por el fabricante. FZAC no limita la responsabilidad solidaria que la
            Ley 24.240 asigna a vendedores, distribuidores, importadores y fabricantes.
          </p>
          <p>
            Los reclamos por producto equivocado, daño, faltante o defecto pueden iniciarse desde el centro de contacto o
            el canal de devoluciones. Informar el problema pronto y acompañar fotos o comprobantes facilita la revisión,
            pero no sustituye ni reduce los plazos y derechos inderogables del consumidor.
          </p>

          <h2>9. Reembolsos</h2>
          <p>
            Una solicitud aprobada no ejecuta por sí sola un reembolso. FZAC verifica el pedido, el estado del pago y la
            mercadería y, cuando corresponde, procesa la devolución por el proveedor original. Los plazos de acreditación
            pueden depender del medio de pago. El sistema evita repetir un mismo reembolso y conserva un registro de la
            decisión administrativa.
          </p>

          <h2>10. Datos personales</h2>
          <p>
            Los datos se utilizan para crear la cuenta, procesar pedidos, coordinar entregas, prevenir fraude, atender
            consultas y cumplir obligaciones legales. El detalle de finalidades, proveedores, conservación y derechos de
            acceso, rectificación y supresión está en la <Link href="/privacidad">Política de privacidad</Link>.
          </p>

          <h2>11. Atención y resolución de conflictos</h2>
          <p>
            FZAC recibe consultas y reclamos por los canales indicados en esta página. También se encuentra disponible la
            <a href="https://www.argentina.gob.ar/servicio/iniciar-un-reclamo-ante-defensa-del-consumidor" target="_blank" rel="noreferrer"> Ventanilla Federal Única de Defensa del Consumidor</a>.
          </p>

          <h2>12. Ley aplicable y jurisdicción</h2>
          <p>
            Se aplica la legislación argentina. En contratos de consumo a distancia, el lugar de cumplimiento es aquel
            donde el consumidor recibió o debió recibir la prestación y determina la jurisdicción aplicable. No se impone
            una renuncia anticipada a la jurisdicción que proteja al consumidor.
          </p>

          <aside className="legal-review-note">
            Este texto organiza la información operativa del e-commerce y debe recibir revisión final de un profesional
            del derecho y del responsable impositivo antes de habilitar cobros productivos.
          </aside>

          <div className="legal-sources">
            <strong>Normativa de referencia</strong>
            <a href="https://www.argentina.gob.ar/normativa/nacional/ley-24240-638/actualizacion" target="_blank" rel="noreferrer">Ley 24.240 de Defensa del Consumidor</a>
            <a href="https://www.argentina.gob.ar/normativa/nacional/ley-26994-235975/actualizacion" target="_blank" rel="noreferrer">Código Civil y Comercial, contratos de consumo</a>
            <a href="https://www.argentina.gob.ar/normativa/nacional/disposici%C3%B3n-954-2025-417152/texto" target="_blank" rel="noreferrer">Disposición 954/2025</a>
          </div>
        </section>
      </div>
    </main>
  );
}
