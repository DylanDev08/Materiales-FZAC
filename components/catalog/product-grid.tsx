"use client";

import { useState } from "react";
import { PackageSearch } from "lucide-react";
import { ProductCarousel } from "@/components/catalog/product-carousel";
import { ProductCard } from "@/components/product/product-card";
import type { Product } from "@/types/domain";

const PRODUCT_PAGE_SIZE = 24;

export function ProductGrid({
  products,
  variant = "grid"
}: {
  products: Product[];
  variant?: "grid" | "list" | "rail";
}) {
  const [visibleCount, setVisibleCount] = useState(PRODUCT_PAGE_SIZE);

  if (!products.length) {
    return (
      <div className="empty-state">
        <div>
          <PackageSearch size={34} />
          <h2>No encontramos productos</h2>
          <p>Probá con otra categoría, rango de precio o búsqueda.</p>
        </div>
      </div>
    );
  }

  if (variant === "rail") {
    return <ProductCarousel products={products} />;
  }

  const visibleProducts = products.slice(0, visibleCount);
  const hasMore = visibleProducts.length < products.length;

  return (
    <>
      <div className={`product-grid ${variant === "list" ? "product-grid--list" : ""}`}>
        {visibleProducts.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
      {hasMore ? (
        <div className="product-grid__more">
          <p aria-live="polite">
            Mostrando <strong>{visibleProducts.length}</strong> de <strong>{products.length}</strong> productos
          </p>
          <button className="btn btn--ghost" type="button" onClick={() => setVisibleCount((count) => count + PRODUCT_PAGE_SIZE)}>
            Mostrar más productos
          </button>
        </div>
      ) : null}
    </>
  );
}
