"use client";

import { useRef } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { ProductCard } from "@/components/product/product-card";
import type { Product } from "@/types/domain";

export function ProductCarousel({ products, label = "Productos recomendados" }: { products: Product[]; label?: string }) {
  const railRef = useRef<HTMLDivElement>(null);

  function move(direction: -1 | 1) {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollBy({ left: direction * Math.max(280, rail.clientWidth * 0.82), behavior: "smooth" });
  }

  return (
    <div className="product-carousel" aria-label={label}>
      <div className="product-carousel__toolbar">
        <span>{products.length} {products.length === 1 ? "opción" : "opciones"}</span>
        {products.length > 1 ? (
          <div className="product-carousel__controls" aria-label="Controles del carrusel">
            <button type="button" onClick={() => move(-1)} aria-label="Ver productos anteriores">
              <ArrowLeft size={18} />
            </button>
            <button type="button" onClick={() => move(1)} aria-label="Ver productos siguientes">
              <ArrowRight size={18} />
            </button>
          </div>
        ) : null}
      </div>
      <div className="product-grid product-grid--rail" ref={railRef} tabIndex={0}>
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}
