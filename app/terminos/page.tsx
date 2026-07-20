import Image from "next/image";
import Link from "next/link";

export default function Page() {
  return (
    <main className="page-section legal-page">
      <div className="container">
        <header className="legal-page__head">
          <span className="legal-page__logo">
            <Image src="/logoFZAC.jpg" alt="FZAC" width={76} height={76} priority />
          </span>
          <div>
            <span className="kicker">Legal FZAC</span>
            <h1>Términos y condiciones</h1>
            <p>Información aplicable a compras, pagos, entrega, retiro, garantías y devoluciones.</p>
          </div>
        </header>
        <nav className="legal-page__actions" aria-label="Acciones legales">
          <Link className="btn" href="/checkout">Volver al checkout</Link>
          <Link className="btn btn--ghost" href="/privacidad">Ver política de privacidad</Link>
        </nav>
        <section>
          <h2>Objeto</h2>
          <p>
            Estos Términos y Condiciones regulan las operaciones de compraventa de materiales de construcción,
            herramental, maquinaria y artículos de ferretería en el sitio oficial de Fortaleza Construcciones,
            con domicilio legal en Hermana Paula 3164, Rosario, Provincia de Santa Fe, Republica Argentina.
          </p>
          <p>
            Toda transacción efectuada a través de la plataforma implica la aceptación expresa de estas condiciones,
            redactadas conforme a la Ley de Defensa del Consumidor Nro. 24.240.
          </p>

          <h2>Derecho de revocación</h2>
          <p>
            Conforme al Art. 34 de la Ley 24.240, el cliente puede revocar la compra dentro de los diez (10) días
            corridos contados desde la entrega efectiva del producto o desde la celebración del contrato, lo que ocurra
            último.
          </p>
          <p>
            Para ejercer este derecho, el cliente debe utilizar el Botón de Arrepentimiento disponible de forma visible
            en la tienda o contactar a FZAC por los canales oficiales indicando orden, datos de compra y producto.
          </p>
          <p>
            El producto debe encontrarse intacto, en su embalaje original cerrado, con accesorios y manuales, sin uso,
            instalación ni acopio inadecuado. Los gastos de envío por devolución originados por el derecho de
            arrepentimiento corren por cuenta de FZAC, coordinando retiro por el medio operativo correspondiente.
          </p>

          <h2>Excepciones por materiales de obra</h2>
          <p>
            Quedan excluidos del derecho de revocacion los materiales a granel o fraccionados, aridos, arena, piedra,
            cemento, cal, ligantes o productos despachados por peso o fraccion exacta que hayan sido manipulados por el
            cliente o expuestos a la intemperie.
          </p>
          <p>
            Tambien quedan excluidos productos personalizados, pinturas o revestimientos preparados a pedido, cables,
            cadenas, perfiles o tuberias cortadas a medida, y materiales deteriorados por humedad, mala estiba o
            exposicion climatica en obra.
          </p>

          <h2>Envíos, entrega en obra y reclamos</h2>
          <p>
            Al momento de la entrega, el cliente o una persona mayor de edad autorizada debe revisar la mercaderia antes
            de firmar el remito de conformidad. La firma del remito implica aceptación del estado estético, integridad y
            cantidades recibidas.
          </p>
          <p>
            No se admiten reclamos posteriores por faltantes visibles o roturas estéticas atribuibles al traslado. Si se
            detectan fallas internas o errores de carga no visibles, el cliente dispone de cuarenta y ocho (48) horas
            hábiles desde la recepción para notificarlo a fortalezaconstruccionesrosario@gmail.com o al WhatsApp
            +54 341 584 7000, adjuntando fotografías y copia del remito.
          </p>
          <p>
            El cliente debe asegurar presencia de personal autorizado para la descarga en el horario pactado. Si no hay
            receptor en obra o el terreno impide el ingreso seguro del transporte, la mercadería regresa a depósito y se
            puede coordinar un segundo viaje con costo de flete adicional.
          </p>

          <h2>Garantías</h2>
          <p>
            Máquinas de trabajo, herramientas eléctricas, a explosión, neumáticas, a batería y herramientas de mano
            cuentan con garantía legal de seis (6) meses contra defectos de fabricación o vicios de material.
          </p>
          <p>
            Las garantías de marcas oficiales deben validarse en Centros de Servicio Técnico Autorizados por el
            fabricante, presentando factura o comprobante de compra. La garantía pierde validez por uso indebido,
            sobrecargas, falta de mantenimiento, insumos incorrectos o reparaciones por personal no autorizado.
          </p>

          <h2>Pagos, stock y comprobantes</h2>
          <p>
            FZAC no solicita ni almacena números de tarjeta, códigos de seguridad ni datos sensibles de medios de pago.
            La confirmación depende del proveedor autorizado. No se descuenta stock ni se emite comprobante hasta que el
            pago queda aprobado.
          </p>
          <p>
            Cada pago aprobado genera un comprobante con número único, detalle de materiales, cantidades, precios,
            impuestos incluidos cuando corresponda, datos de entrega o retiro y firma digital FZAC.
          </p>

          <h2>Jurisdicción</h2>
          <p>
            Ante cualquier divergencia, las partes se someten a la legislación vigente de la República Argentina y a la
            jurisdicción de los Tribunales Provinciales de Rosario, renunciando a cualquier otro fuero o jurisdicción.
          </p>
        </section>
      </div>
    </main>
  );
}
