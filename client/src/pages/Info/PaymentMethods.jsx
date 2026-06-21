export const PaymentMethods = () => (
  <main className="page legal-page-v2">
    <section className="simple-hero"><div className="container"><span className="kicker">Medios de pago</span><h1>Pagos seguros con Mercado Pago.</h1><p>Las compras se abonan desde el checkout web y se confirman cuando el backend recibe la aprobación del proveedor.</p></div></section>
    <section className="section"><div className="container legal-grid-v2">
      <article><h2>Confirmación</h2><p>El pedido queda pendiente hasta que Mercado Pago informa el pago aprobado mediante webhook.</p></article>
      <article><h2>Seguridad</h2><p>Materiales FZAC no guarda datos de tarjeta. El proveedor procesa la operación en su entorno seguro.</p></article>
      <article><h2>Ticket</h2><p>Cuando el pago se aprueba, se descuenta stock y se emite un ticket interno del pedido.</p></article>
    </div></section>
  </main>
);
