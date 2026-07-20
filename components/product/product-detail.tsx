import { ProductBuyBox } from "@/components/product/product-buybox";
import { ProductGallery } from "@/components/product/product-gallery";
import { ProductGrid } from "@/components/catalog/product-grid";
import { SectionHeader } from "@/components/ui/section-header";
import type { Product } from "@/types/domain";

export function ProductDetail({ product, related }: { product: Product; related: Product[] }) {
  const gallery = [product.image_url, ...product.gallery].filter(Boolean);

  return (
    <main className="page-section">
      <div className="container">
        <div className="product-detail">
          <ProductGallery name={product.name} images={gallery} />

          <ProductBuyBox product={product} />
        </div>

        <section className="product-information" aria-label="Información del producto">
          <details open>
            <summary>Descripción</summary>
            <div>
              <p>{product.description}</p>
            </div>
          </details>
          <details>
            <summary>Ficha técnica</summary>
            <div>
              <ul>
                {Object.entries(product.specifications).map(([key, value]) => (
                  <li key={key}>
                    <strong>{key}:</strong> {String(value)}
                  </li>
                ))}
              </ul>
            </div>
          </details>
          <details>
            <summary>Entrega y retiro</summary>
            <div>
              <p>Retiro coordinado en FZAC o envío cotizado según dirección, distancia y disponibilidad.</p>
            </div>
          </details>
          <details>
            <summary>Medios de pago</summary>
            <div>
              <p>Tarjeta segura con Mercado Pago, Checkout Pro, transferencia pendiente de revisión o coordinación por WhatsApp.</p>
            </div>
          </details>
        </section>

        <section className="page-section">
          <SectionHeader eyebrow="Complementarios" title="Productos relacionados" />
          <ProductGrid products={related} variant="rail" />
        </section>
      </div>
    </main>
  );
}
