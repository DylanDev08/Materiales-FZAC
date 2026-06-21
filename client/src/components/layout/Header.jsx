import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { FiMenu, FiShoppingCart, FiUser, FiPackage, FiMapPin, FiShield, FiX } from 'react-icons/fi';

import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { BrandMark } from '../common/BrandMark';
import { SearchAssist } from '../common/SearchAssist';

const nav = [
  ['Catálogo', '/catalogo'],
  ['Productos', '/productos'],
  ['Ofertas', '/ofertas'],
  ['Categorías', '/categorias'],
  ['Nosotros', '/nosotros']
];

export const Header = () => {
  const [open, setOpen] = useState(false);
  const { cartCount } = useCart();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const search = (query) => {
    navigate(`/productos${query ? `?search=${encodeURIComponent(query)}` : ''}`);
    setOpen(false);
  };

  return (
    <header className="site-header market-header fzac-header">
      <div className="topbar market-topbar">
        <div className="container topbar__row market-topbar__row">
          <span><FiMapPin /> Retiro o envío coordinado</span>
          <span><FiShield /> Compra segura y atención FZAC</span>
        </div>
      </div>

      <div className="container header-main market-header-main">
        <Link to="/" className="brand market-brand fzac-header__brand" onClick={() => setOpen(false)}>
          <BrandMark />
        </Link>

        <SearchAssist
          className="search market-search fzac-header__search"
          name="q"
          placeholder="Buscar materiales, herramientas, perfiles..."
          onSubmit={search}
        />

        <div className="header-actions market-header-actions">
          {user ? (
            <>
              <Link className="mini-btn" to="/cuenta"><FiUser /> Cuenta</Link>
              <button onClick={logout} className="mini-btn" type="button">Salir</button>
            </>
          ) : (
            <Link className="mini-btn" to="/login"><FiUser /> Ingresar</Link>
          )}

          <Link className="mini-btn" to="/pedidos"><FiPackage /> Pedidos</Link>
          <Link className="mini-btn cart" to="/carrito">
            <FiShoppingCart /> Carrito {cartCount > 0 && <b>{cartCount}</b>}
          </Link>
        </div>

        <button className="hamb market-hamb" type="button" onClick={() => setOpen((current) => !current)} aria-label="Abrir menú">
          {open ? <FiX /> : <FiMenu />}
        </button>
      </div>

      <nav className={`nav market-nav ${open ? 'open' : ''}`}>
        <div className="container nav__row market-nav__row">
          {nav.map(([label, to]) => (
            <NavLink key={label} to={to} onClick={() => setOpen(false)}>
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </header>
  );
};
