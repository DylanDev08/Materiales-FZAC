import { PackageSearch } from "lucide-react";
import { ProductCard } from "@/components/product/product-card";
import type { Product } from "@/types/domain";

export function ProductGrid({
  products,
  variant = "grid"
}: {
  products: Product[];
  variant?: "grid" | "list" | "rail";
}) {
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

  return (
    <div
      className={`product-grid ${variant === "rail" ? "product-grid--rail" : ""} ${variant === "list" ? "product-grid--list" : ""}`}
    >
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
