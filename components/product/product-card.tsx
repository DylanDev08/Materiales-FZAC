"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, CheckCircle, ShoppingCart, Truck } from "lucide-react";
import { useCart } from "@/components/cart/cart-provider";
import { currency, percentOff } from "@/lib/formatters/currency";
import type { Product } from "@/types/domain";

export function ProductCard({ product }: { product: Product }) {
  const { addItem, hydrated } = useCart();
  const [isAdding, setIsAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const discount = percentOff(product.price, product.compare_price);

  function addToCart() {
    if (!hydrated || isAdding || product.stock <= 0) return;
    setIsAdding(true);
    addItem(product, 1);
    setAdded(true);
    window.requestAnimationFrame(() => setIsAdding(false));
  }

  useEffect(() => {
    if (!added) return;
    const timer = window.setTimeout(() => setAdded(false), 4500);
    return () => window.clearTimeout(timer);
  }, [added]);

  return (
    <article className="product-card">
      <Link className="product-card__media" href={`/producto/${product.slug}`}>
        <Image
          src={product.image_url}
          alt={product.name}
          fill
          sizes="(max-width: 400px) 100vw, (max-width: 820px) 50vw, (max-width: 1200px) 25vw, 220px"
        />
        <div className="product-card__badges">
          {discount ? <span className="status-pill status-pill--warning">Oferta</span> : null}
          {product.stock > 0 && product.stock <= product.stock_minimum ? (
            <span className="status-pill status-pill--danger">Stock bajo</span>
          ) : null}
          {product.stock > 0 ? (
            <span className="status-pill status-pill--success">
              <Truck size={14} /> Disponible
            </span>
          ) : (
            <span className="status-pill status-pill--danger">Sin stock</span>
          )}
        </div>
      </Link>

      <div className="product-card__body">
        <div className="product-card__meta">
          <span>{product.category?.name ?? product.subcategory}</span>
          <span>{product.brand}</span>
        </div>
        <Link href={`/producto/${product.slug}`}>
          <h3>{product.name}</h3>
        </Link>
        <div className="product-card__price">
          <strong>{currency(product.price)}</strong>
          {product.compare_price ? <del>{currency(product.compare_price)}</del> : null}
        </div>
        <span className={`product-card__stock ${product.stock > 0 ? "" : "product-card__stock--empty"}`}>
          {product.stock > 0 ? `${product.stock} ${product.unit} disponibles` : "Sin stock"}
        </span>

        <div className="product-card__actions">
          <button className="btn" type="button" disabled={!hydrated || product.stock <= 0 || isAdding} onClick={addToCart}>
            <ShoppingCart size={18} />
            {!hydrated ? "Cargando..." : isAdding ? "Agregando..." : "Agregar"}
          </button>
          <Link className="btn btn--ghost product-card__detail" href={`/producto/${product.slug}`} aria-label={`Ver detalle de ${product.name}`}>
            Detalle <ArrowRight size={16} />
          </Link>
        </div>
        {added ? (
          <div className="product-card__toast" role="status" aria-live="polite">
            <strong>
              <CheckCircle size={15} /> Producto agregado
            </strong>
            <small>
              {product.name} · Cantidad 1
            </small>
            <span>
              <Link href="/carrito">Ver carrito</Link>
              <Link href="/productos">Seguir comprando</Link>
            </span>
          </div>
        ) : null}
      </div>
    </article>
  );
}
