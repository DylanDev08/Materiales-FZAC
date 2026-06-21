import { useRef } from 'react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { ProductCard } from './ProductCard';
import { EmptyState } from '../common/EmptyState';

export const ProductCarousel = ({
  products = [],
  title,
  eyebrow,
  text,
  action,
  getLinkTo,
  emptyTitle = 'No encontramos productos',
  emptyText = 'Probá cambiar los filtros o la búsqueda.'
}) => {
  const scrollerRef = useRef(null);

  const scroll = (direction) => {
    const node = scrollerRef.current;
    if (!node) return;

    const amount = Math.min(node.clientWidth * 0.9, 920);

    node.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth'
    });
  };

  return (
    <section className="market-carousel-block">
      {(title || text || action) && (
        <div className="market-section-head market-section-head--row">
          <div>
            {eyebrow && <span className="kicker">{eyebrow}</span>}
            {title && <h2>{title}</h2>}
            {text && <p>{text}</p>}
          </div>

          <div className="market-carousel-actions">
            {action}
            <button type="button" aria-label="Ver anteriores" onClick={() => scroll('left')}>
              <FiChevronLeft />
            </button>
            <button type="button" aria-label="Ver siguientes" onClick={() => scroll('right')}>
              <FiChevronRight />
            </button>
          </div>
        </div>
      )}

      {products.length > 0 ? (
        <div className="market-carousel" ref={scrollerRef}>
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              linkTo={getLinkTo ? getLinkTo(product) : undefined}
            />
          ))}
        </div>
      ) : (
        <EmptyState title={emptyTitle} text={emptyText} />
      )}
    </section>
  );
};
