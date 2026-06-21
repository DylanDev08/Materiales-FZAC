import { Link } from 'react-router-dom';
import {
  FiCreditCard,
  FiExternalLink,
  FiInstagram,
  FiMail,
  FiMapPin,
  FiMessageCircle,
  FiShield,
  FiTruck
} from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';

import { BrandMark } from '../common/BrandMark';

export const Footer = () => (
  <footer className="site-footer fzac-footer-v2">
    <div className="fzac-footer-v2__trust">
      <div className="container fzac-footer-v2__trust-grid">
        <div><FiCreditCard /><span><strong>Pago online seguro</strong><small>Checkout protegido por Mercado Pago</small></span></div>
        <div><FiTruck /><span><strong>Retiro o entrega</strong><small>Coordinacion en Rosario y alrededores</small></span></div>
        <div><FiShield /><span><strong>Respaldo FZAC</strong><small>Fortaleza Construcciones</small></span></div>
      </div>
    </div>

    <div className="container fzac-footer-v2__grid">
      <section className="fzac-footer-v2__brand">
        <Link to="/" className="footer-brand fzac-footer-brand"><BrandMark /></Link>
        <p>Tienda online de materiales, herramientas e insumos para obra. Catalogo, pago, pedidos y asistencia centralizados en la web.</p>
        <div className="fzac-footer-v2__socials">
          <a href="https://www.instagram.com/fzaconstrucciones" target="_blank" rel="noreferrer" aria-label="Instagram FZAC"><FiInstagram /></a>
          <a href="mailto:fortalezaconstruccionesrosario@gmail.com" aria-label="Email FZAC"><FiMail /></a>
          <a href="https://wa.me/5493415847000" target="_blank" rel="noreferrer" aria-label="WhatsApp FZAC"><FaWhatsapp /></a>
          <Link to="/contacto" aria-label="Chat y atencion FZAC"><FiMessageCircle /></Link>
        </div>
      </section>

      <section>
        <h4>Tienda</h4>
        <Link to="/catalogo">Catalogo completo</Link>
        <Link to="/ofertas">Ofertas</Link>
        <Link to="/categorias">Categorias</Link>
        <Link to="/carrito">Carrito</Link>
        <Link to="/pedidos">Mis pedidos</Link>
      </section>

      <section>
        <h4>Cuenta</h4>
        <Link to="/login">Ingresar</Link>
        <Link to="/registro">Crear cuenta</Link>
        <Link to="/cuenta">Ajustes</Link>
        <Link to="/cuenta?tab=favorites">Favoritos</Link>
        <Link to="/cuenta?tab=chats">Asistencia</Link>
      </section>

      <section>
        <h4>Ayuda y legal</h4>
        <Link to="/nosotros">Nosotros</Link>
        <Link to="/contacto">Atencion comercial</Link>
        <Link to="/terminos">Terminos y condiciones</Link>
        <Link to="/privacidad">Politica de privacidad</Link>
        <Link to="/cambios-y-devoluciones">Cambios y devoluciones</Link>
        <Link to="/medios-de-pago">Medios de pago</Link>
        <Link to="/envios-y-retiros">Envios y retiros</Link>
        <Link to="/preguntas-frecuentes">Preguntas frecuentes</Link>
      </section>

      <section>
        <h4>Fortaleza Construcciones</h4>
        <p><FiMapPin /> Rosario, Santa Fe</p>
        <a href="https://fzac-portfolio-jek3.vercel.app" target="_blank" rel="noreferrer">Ver portfolio institucional <FiExternalLink /></a>
        <a href="https://www.instagram.com/fzaconstrucciones" target="_blank" rel="noreferrer">@fzaconstrucciones <FiExternalLink /></a>
      </section>
    </div>

    <div className="container fzac-footer-v2__legal">
      <span>Copyright {new Date().getFullYear()} Materiales FZAC. Todos los derechos reservados.</span>
      <span>Uso sujeto a terminos, privacidad, cambios, pagos, envios y condiciones legales vigentes.</span>
    </div>
  </footer>
);
