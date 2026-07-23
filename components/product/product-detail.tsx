import Link from "next/link";
import { ChevronRight, CreditCard, PackageCheck, ShieldCheck, Truck } from "lucide-react";
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
        <nav className="product-breadcrumb" aria-label="Navegación del producto">
          <Link href="/productos" prefetch={false}>Productos</Link>
          <ChevronRight size={14} />
          {product.category?.slug ? (
            <Link href={`/categoria/${product.category.slug}`} prefetch={false}>{product.category.name}</Link>
          ) : (
            <span>{product.subcategory}</span>
          )}
          <ChevronRight size={14} />
          <span aria-current="page">{product.name}</span>
        </nav>

        <div className="product-detail">
          <ProductGallery name={product.name} images={gallery} />

          <ProductBuyBox product={product} />
        </div>

        <section className="product-assurance-strip" aria-label="Condiciones de compra">
          <div>
            <PackageCheck size={19} />
            <span><strong>Stock validado</strong> antes de cobrar</span>
          </div>
          <div>
            <Truck size={19} />
            <span><strong>Retiro o envío</strong> según tu dirección</span>
          </div>
          <div>
            <CreditCard size={19} />
            <span><strong>Pago seguro</strong> con Mercado Pago</span>
          </div>
          <div>
            <ShieldCheck size={19} />
            <span><strong>Datos protegidos</strong> por FZAC</span>
          </div>
        </section>

        <section className="product-information" aria-label="Información del producto">
          <details open>
            <summary>Descripción</summary>
            <div>
              <p>{product.description || "Consultá con FZAC para confirmar presentación, rendimiento y compatibilidad con tu obra."}</p>
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

        {related.length ? (
          <section className="page-section product-related">
            <SectionHeader eyebrow="Complementarios" title="Completá el pedido" />
            <ProductGrid products={related} variant="rail" />
          </section>
        ) : null}
      </div>
    </main>
  );
}
