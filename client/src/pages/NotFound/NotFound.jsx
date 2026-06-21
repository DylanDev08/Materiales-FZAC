import { Link } from 'react-router-dom';

export const NotFound = () => (
  <main className="page">
    <section className="payment">
      <div className="container payment-box">
        <span className="not-code">404</span>
        <h1>Página no encontrada.</h1>
        <p>La sección no existe o fue movida.</p>
        <Link className="btn" to="/">Volver al inicio</Link>
      </div>
    </section>
  </main>
);
