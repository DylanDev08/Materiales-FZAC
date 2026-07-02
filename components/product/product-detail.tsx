import Image from "next/image";
import { ProductBuyBox } from "@/components/product/product-buybox";
import { ProductGrid } from "@/components/catalog/product-grid";
import { SectionHeader } from "@/components/ui/section-header";
import type { Product } from "@/types/domain";

export function ProductDetail({ product, related }: { product: Product; related: Product[] }) {
  const gallery = [product.image_url, ...product.gallery].filter(Boolean);

  return (
    <main className="page-section">
      <div className="container">
        <div className="product-detail">
          <section className="product-gallery" aria-label="Galeria del producto">
            <div className="product-gallery__main">
              <Image src={product.image_url} alt={product.name} fill sizes="(max-width: 900px) 100vw, 52vw" />
            </div>
            <div className="product-gallery__thumbs">
              {gallery.slice(0, 4).map((image) => (
                <div className="product-gallery__thumb" key={image}>
                  <Image src={image} alt={product.name} fill sizes="25vw" />
                </div>
              ))}
            </div>
          </section>

          <ProductBuyBox product={product} />
        </div>

        <section className="product-info-grid">
          <article>
            <h2>Descripcion</h2>
            <p>{product.description}</p>
          </article>
          <article>
            <h2>Ficha tecnica</h2>
            <ul>
              {Object.entries(product.specifications).map(([key, value]) => (
                <li key={key}>
                  <strong>{key}:</strong> {String(value)}
                </li>
              ))}
            </ul>
          </article>
          <article>
            <h2>Entrega y retiro</h2>
            <p>Retiro coordinado en FZAC o envio a domicilio acordado por administracion segun direccion y disponibilidad.</p>
          </article>
        </section>

        <section className="page-section">
          <SectionHeader eyebrow="Complementarios" title="Productos relacionados" />
          <ProductGrid products={related} />
        </section>
      </div>
    </main>
  );
}
