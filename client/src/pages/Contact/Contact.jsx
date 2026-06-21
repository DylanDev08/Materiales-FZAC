import { Link } from 'react-router-dom';
import { FiMail, FiMessageCircle, FiUser } from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';

export const Contact = () => (
  <main className="page contact-page-v2">
    <section className="simple-hero contact-hero"><div className="container"><span className="kicker">Atención FZAC</span><h1>Consultas antes y después de comprar.</h1><p>Usá el asistente para buscar productos o ingresá a tu cuenta para mantener una conversación con atención administrativa.</p></div></section>
    <section className="section"><div className="container contact-grid-v2">
      <article><FiMessageCircle /><h2>Asistente FZAC</h2><p>Buscá materiales, compará opciones y pedí derivación a una persona desde el botón flotante.</p><Link className="btn" to="/productos">Buscar productos</Link></article>
      <article><FiUser /><h2>Chat de cuenta</h2><p>Conservá el historial de consultas y respuestas administrativas.</p><Link className="btn" to="/cuenta?tab=chats">Abrir mis chats</Link></article>
      <article><FiMail /><h2>Email</h2><p>fortalezaconstruccionesrosario@gmail.com</p><a className="btn secondary" href="mailto:fortalezaconstruccionesrosario@gmail.com">Enviar email</a></article>
      <article><FaWhatsapp /><h2>WhatsApp</h2><p>Canal complementario para coordinación puntual.</p><a className="btn secondary" href="https://wa.me/5493415847000" target="_blank" rel="noreferrer">Abrir WhatsApp</a></article>
    </div></section>
  </main>
);
