import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { FzacAssistant } from '../assistant/FzacAssistant';

export const Layout = () => (
  <>
    <Header />
    <Outlet />
    <Footer />
    <FzacAssistant />
  </>
);
