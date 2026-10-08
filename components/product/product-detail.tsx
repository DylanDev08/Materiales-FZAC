import Link from "next/link";
import { ChevronRight, MessageCircle, PackageCheck, ShieldCheck, Truck } from "lucide-react";
import { ProductBuyBox } from "@/components/product/product-buybox";
import { ProductGallery } from "@/components/product/product-gallery";
import { ProductGrid } from "@/components/catalog/product-grid";
import { SectionHeader } from "@/components/ui/section-header";
import type { Product } from "@/types/domain";

export function ProductDetail({ product, related }: { product: Product; related: Product[] }) {
  const gallery = [product.image_url, ...product.gallery].filter(Boolean);
  const hasProductImage = gallery.length > 0;
  const displayGallery = hasProductImage ? gallery : ["/logoFZAC.jpg"];
  const availabilityStatus = product.availability_status ?? (product.stock > 0 ? "IN_STOCK" : "OUT_OF_STOCK");
  const specificationEntries = Object.entries(product.specifications);

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
          <ProductGallery name={product.name} images={displayGallery} placeholder={!hasProductImage} />

          <ProductBuyBox product={product} />
        </div>

        <section className="product-assurance-strip" aria-label="Condiciones de compra">
          <div>
            {availabilityStatus === "CONSULT" ? <MessageCircle size={19} /> : <PackageCheck size={19} />}
            <span>
              {availabilityStatus === "CONSULT" ? (
                <><strong>Stock a confirmar</strong> antes de coordinar</>
              ) : availabilityStatus === "OUT_OF_STOCK" ? (
                <><strong>Sin stock</strong> para compra directa</>
              ) : (
                <><strong>Stock validado</strong> antes de confirmar</>
              )}
            </span>
          </div>
          <div>
            <Truck size={19} />
            <span><strong>Retiro o envío</strong> según zona</span>
          </div>
          <div>
            <MessageCircle size={19} />
            <span><strong>Pago coordinado</strong> por WhatsApp</span>
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
              {specificationEntries.length ? (
                <ul>
                  {specificationEntries.map(([key, value]) => (
                    <li key={key}>
                      <strong>{key}:</strong> {String(value)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Consultá con FZAC para confirmar medidas, presentación y especificaciones técnicas del producto.</p>
              )}
            </div>
          </details>
          <details>
            <summary>Entrega y retiro</summary>
            <div>
              <p>Retiro en FZAC o envío cotizado según tu dirección.</p>
            </div>
          </details>
          <details>
            <summary>Medios de pago</summary>
            <div>
              <p>El pago se coordina directamente por WhatsApp con el equipo de FZAC una vez confirmado el pedido.</p>
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
