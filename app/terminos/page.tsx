export default function Page() {
  return (
    <main className="page-section legal-page">
      <div className="container">
        <span className="kicker">Legal</span>
        <h1>Terminos y condiciones</h1>
        <section>
          <h2>Objeto</h2>
          <p>
            Materiales FZAC permite consultar productos, armar pedidos y pagar mediante proveedores externos. La compra
            queda sujeta a disponibilidad real de stock, validacion de pago y confirmacion administrativa.
          </p>
          <h2>Precios y stock</h2>
          <p>
            Los precios y stock visibles se validan nuevamente en backend al crear la orden. FZAC puede corregir errores
            evidentes antes de confirmar una operacion comercial.
          </p>
          <h2>Pagos</h2>
          <p>
            FZAC no solicita ni almacena numeros de tarjeta, codigos de seguridad ni datos sensibles de medios de pago.
            La confirmacion depende del proveedor autorizado. No se descuenta stock ni se emite ticket hasta pago aprobado.
          </p>
          <h2>Entrega y retiro</h2>
          <p>
            El envio se valida por distancia desde Rosario hasta 30 km. Si la direccion queda fuera de zona, el cliente
            puede elegir retiro o coordinar una entrega especial con FZAC.
          </p>
          <h2>Tickets</h2>
          <p>
            Cada pago aprobado genera un ticket con numero unico, detalle de productos, cantidades, medio de pago y datos
            de entrega o retiro.
          </p>
        </section>
      </div>
    </main>
  );
}
