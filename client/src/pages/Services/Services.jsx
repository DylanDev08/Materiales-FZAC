import { Link } from 'react-router-dom';
import { FiArrowRight, FiCheckCircle, FiPackage, FiShield, FiTruck } from 'react-icons/fi';

const workItems = [
  {
    title: 'Catálogo organizado',
    text: 'Agrupamos materiales, herramientas e insumos por rubro para que el cliente encuentre rápido lo que necesita.',
    icon: FiPackage
  },
  {
    title: 'Pedido claro',
    text: 'El usuario puede buscar, comparar, agregar al carrito y avanzar con una compra más ordenada.',
    icon: FiCheckCircle
  },
  {
    title: 'Coordinación comercial',
    text: 'La entrega, retiro, disponibilidad y consultas se acompañan con atención directa del equipo FZAC.',
    icon: FiTruck
  },
  {
    title: 'Respaldo Fortaleza',
    text: 'Materiales FZAC funciona como canal comercial digital de Fortaleza Construcciones.',
    icon: FiShield
  }
];

export const Services = () => (
  <main className="page marketplace-page about-page">
    <section className="market-page-hero about-hero">
      <div className="container">
        <span className="kicker">Nosotros</span>
        <h1>Materiales FZAC acompaña compras de obra con atención clara y ordenada.</h1>
        <p>
          FZAC nace como una tienda digital pensada para centralizar materiales,
          pedidos y consultas comerciales vinculadas a obra, mantenimiento y construcción.
        </p>
        <div className="market-hero__actions">
          <Link className="btn" to="/productos">Ver productos <FiArrowRight /></Link>
          <a className="btn secondary" href="https://wa.me/5493415847000" target="_blank" rel="noreferrer">Contactar</a>
        </div>
      </div>
    </section>

    <section className="market-section about-section">
      <div className="container about-copy-grid">
        <article>
          <span className="kicker">Cómo trabajamos</span>
          <h2>Una experiencia comercial más simple para comprar materiales.</h2>
          <p>
            El objetivo de Materiales FZAC es que cada cliente pueda consultar el catálogo,
            revisar disponibilidad, armar su pedido y coordinar los pasos siguientes sin perder
            información entre mensajes sueltos.
          </p>
          <p>
            La tienda permite ordenar productos por categoría, acceder a ofertas, guardar datos
            de cuenta y consultar el seguimiento de pedidos desde un mismo lugar.
          </p>
        </article>

        <aside>
          <strong>Enfoque FZAC</strong>
          <p>
            Atención cercana, catálogo claro y coordinación comercial para compras de obra,
            reposición y mantenimiento.
          </p>
        </aside>
      </div>
    </section>

    <section className="market-section">
      <div className="container market-about-grid">
        {workItems.map(({ title, text, icon: Icon }) => (
          <article key={title}>
            <Icon />
            <h3>{title}</h3>
            <p>{text}</p>
          </article>
        ))}
      </div>
    </section>
  </main>
);
