import { Link } from 'react-router-dom';
import { FiCheckCircle, FiCreditCard, FiPackage, FiShoppingCart } from 'react-icons/fi';

const steps = [
  {
    icon: FiShoppingCart,
    title: 'Elegí productos',
    text: 'Buscá por rubro, marca o nombre y agregá las cantidades al carrito.'
  },
  {
    icon: FiPackage,
    title: 'Revisá tu pedido',
    text: 'Controlá productos, cantidades, retiro o entrega y tus datos de contacto.'
  },
  {
    icon: FiCreditCard,
    title: 'Pagá de forma segura',
    text: 'El pago se procesa con Mercado Pago y Materiales FZAC no guarda datos de tarjeta.'
  },
  {
    icon: FiCheckCircle,
    title: 'Seguí la compra',
    text: 'Con el pago aprobado, el pedido aparece en tu cuenta para seguir cada estado.'
  }
];

export const HowToBuy = () => (
  <main className="page">
    <section className="simple-hero">
      <div className="container">
        <span className="kicker">Cómo comprar</span>
        <h1>Un proceso simple, seguro y trazable.</h1>
        <p>Todo el flujo ocurre dentro de la web, desde el carrito hasta el seguimiento del pedido.</p>
      </div>
    </section>

    <section className="section">
      <div className="container steps">
        {steps.map(({ icon: Icon, title, text }, index) => (
          <article key={title}>
            <span>0{index + 1}</span>
            <Icon />
            <h3>{title}</h3>
            <p>{text}</p>
          </article>
        ))}
      </div>

      <div className="container callout">
        <h2>La orden se confirma después del pago aprobado.</h2>
        <p>Así evitamos pedidos incompletos y tu compra queda registrada en el sistema.</p>
        <Link className="btn" to="/catalogo">Empezar compra</Link>
      </div>
    </section>
  </main>
);
