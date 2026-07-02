import { PackageSearch } from "lucide-react";
import { ProductCard } from "@/components/product/product-card";
import type { Product } from "@/types/domain";

export function ProductGrid({ products }: { products: Product[] }) {
  if (!products.length) {
    return (
      <div className="empty-state">
        <div>
          <PackageSearch size={34} />
          <h2>No encontramos productos</h2>
          <p>Probá con otra categoria, rango de precio o busqueda.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="product-grid">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
