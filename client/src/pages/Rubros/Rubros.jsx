import { Link } from 'react-router-dom';
import { FiArrowRight, FiBox, FiGrid, FiZap, FiDroplet, FiTool, FiHome } from 'react-icons/fi';
import { categories } from '../../data/mockData';

const icons = {
  'construccion-seca': FiHome,
  materiales: FiBox,
  electricidad: FiZap,
  plomeria: FiDroplet,
  pintura: FiGrid,
  herramientas: FiTool
};

export const Rubros = () => (
  <main className="page marketplace-page">
    <section className="market-page-hero market-page-hero--compact">
      <div className="container">
        <span className="kicker">Categorías</span>
        <h1>Comprá por tipo de producto.</h1>
        <p>Elegí una categoría y entrá directo a productos filtrados, listos para agregar al carrito.</p>
      </div>
    </section>

    <section className="market-section">
      <div className="container market-category-page-grid">
        {categories.map((category) => {
          const Icon = icons[category.slug] || FiGrid;

          return (
            <Link key={category.slug} to={`/productos?category=${category.slug}`} className="market-category-card">
              <Icon />
              <div>
                <h3>{category.name}</h3>
                <p>{category.description}</p>
              </div>
              <span>Ver productos <FiArrowRight /></span>
            </Link>
          );
        })}
      </div>
    </section>
  </main>
);
