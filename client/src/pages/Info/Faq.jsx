const faqs = [
  ['¿Cuándo se confirma mi pedido?', 'Cuando Mercado Pago informa el pago aprobado al servidor.'],
  ['¿Se descuenta stock al iniciar el checkout?', 'No. El stock se descuenta dentro de una transacción cuando el pago queda aprobado.'],
  ['¿Puedo retirar en lugar de pedir envío?', 'Sí. El checkout permite elegir retiro coordinado o envío.'],
  ['¿Dónde consulto un pedido?', 'Desde la sección Mis pedidos de tu cuenta.']
];

export const Faq = () => (
  <main className="page legal-page-v2">
    <section className="simple-hero"><div className="container"><span className="kicker">Preguntas frecuentes</span><h1>Respuestas rápidas para comprar materiales.</h1><p>Información operativa sobre pagos, stock, retiro, envío y seguimiento.</p></div></section>
    <section className="section"><div className="container legal-grid-v2">
      {faqs.map(([title, text]) => <article key={title}><h2>{title}</h2><p>{text}</p></article>)}
    </div></section>
  </main>
);
