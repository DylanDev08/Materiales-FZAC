import { Outlet } from 'react-router-dom';
import { FaWhatsapp } from 'react-icons/fa';
import { Header } from './Header';
import { Footer } from './Footer';
import { FzacAssistant } from '../assistant/FzacAssistant';

export const Layout = () => (
  <>
    <Header />
    <Outlet />
    <Footer />
    <a
      className="fzac-whatsapp-float"
      href="https://wa.me/5493415847000"
      target="_blank"
      rel="noreferrer"
      aria-label="Abrir WhatsApp FZAC"
    >
      <FaWhatsapp />
      <span>WhatsApp</span>
    </a>
    <FzacAssistant />
  </>
);
