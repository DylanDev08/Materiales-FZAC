"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, CheckCircle, MessageCircle, ShieldCheck, ShoppingCart } from "lucide-react";
import { useCart } from "@/components/cart/cart-provider";
import { currency, percentOff } from "@/lib/formatters/currency";
import {
  canPurchaseProduct,
  getProductAvailabilityStatus,
  productAvailabilityLabel
} from "@/lib/products/availability";
import type { Product } from "@/types/domain";

export function ProductCard({ product }: { product: Product }) {
  const { addItem, hydrated } = useCart();
  const [isAdding, setIsAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const discount = percentOff(product.price, product.compare_price);
  const hasValidComparePrice = Boolean(product.compare_price && product.compare_price > product.price);
  const availabilityStatus = getProductAvailabilityStatus(product);
  const purchasable = canPurchaseProduct(product);
  const availabilityLabel = productAvailabilityLabel(product, { includeQuantity: true });

  function addToCart() {
    if (!hydrated || isAdding || !purchasable) return;
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
      <Link className="product-card__media" href={`/producto/${product.slug}`} prefetch={false}>
        <Image
          src={product.image_url}
          alt={product.name}
          fill
          sizes="(max-width: 400px) 100vw, (max-width: 820px) 50vw, (max-width: 1200px) 25vw, 220px"
        />
        <div className="product-card__badges">
          {discount ? <span className="status-pill status-pill--warning">{discount}% OFF</span> : null}
          {purchasable && product.stock <= product.stock_minimum ? (
            <span className="status-pill status-pill--danger">Stock bajo</span>
          ) : null}
          {availabilityStatus === "CONSULT" ? (
            <span className="status-pill status-pill--warning">Consultar disponibilidad</span>
          ) : null}
          {availabilityStatus === "OUT_OF_STOCK" ? (
            <span className="status-pill status-pill--danger">Sin stock</span>
          ) : null}
        </div>
      </Link>

      <div className="product-card__body">
        <div className="product-card__meta">
          <span>{product.brand}</span>
          <span>{product.category?.name ?? product.subcategory}</span>
        </div>
        <Link href={`/producto/${product.slug}`} prefetch={false}>
          <h3>{product.name}</h3>
        </Link>
        <span className="product-card__seller">Vendido por FZAC</span>
        <div className="product-card__price">
          <strong>{currency(product.price)}</strong>
          {hasValidComparePrice ? <del>{currency(product.compare_price!)}</del> : null}
        </div>
        <span className={`product-card__stock ${availabilityStatus === "OUT_OF_STOCK" ? "product-card__stock--empty" : ""}`}>
          {availabilityLabel}
        </span>
        <span className="product-card__finance">
          {purchasable ? (
            <><ShieldCheck size={14} /> Pago seguro y stock validado</>
          ) : (
            <><MessageCircle size={14} /> Disponibilidad a confirmar antes de comprar</>
          )}
        </span>

        <div className="product-card__actions">
          {purchasable ? (
            <button className="btn" type="button" disabled={!hydrated || isAdding} onClick={addToCart}>
              <ShoppingCart size={18} />
              {!hydrated ? "Cargando..." : isAdding ? "Agregando..." : "Agregar"}
            </button>
          ) : (
            <Link className="btn" href={`/producto/${product.slug}`} prefetch={false}>
              <MessageCircle size={18} />
              {availabilityStatus === "CONSULT" ? "Consultar" : "Ver alternativas"}
            </Link>
          )}
          <Link
            className="btn btn--ghost product-card__detail"
            href={`/producto/${product.slug}`}
            aria-label={`Ver detalle de ${product.name}`}
            prefetch={false}
          >
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
              <Link href="/carrito" prefetch={false}>Ver carrito</Link>
              <Link href="/productos" prefetch={false}>Seguir comprando</Link>
            </span>
          </div>
        ) : null}
      </div>
    </article>
  );
}
