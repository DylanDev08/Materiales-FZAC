"use client";

import Link from "next/link";
import Image from "next/image";
import { BadgeCheck, CreditCard, Eye, ShoppingCart, Truck } from "lucide-react";
import { useCart } from "@/components/cart/cart-provider";
import { currency, percentOff } from "@/lib/formatters/currency";
import type { Product } from "@/types/domain";

export function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  const discount = percentOff(product.price, product.compare_price);

  return (
    <article className="product-card">
      <Link className="product-card__media" href={`/producto/${product.slug}`}>
        <Image src={product.image_url} alt={product.name} fill sizes="(max-width: 540px) 100vw, (max-width: 820px) 50vw, 33vw" />
        <div className="product-card__badges">
          {discount ? <span className="status-pill status-pill--warning">-{discount}% OFF</span> : null}
          {product.stock > 0 ? (
            <span className="status-pill status-pill--success">
              <Truck size={14} /> Envio
            </span>
          ) : null}
        </div>
      </Link>

      <div className="product-card__body">
        <div className="product-card__meta">
          <span>{product.brand}</span>
          <span>{product.sku}</span>
        </div>
        <Link href={`/producto/${product.slug}`}>
          <h3>{product.name}</h3>
        </Link>
        <span className="product-card__seller">
          <BadgeCheck size={15} /> Vendido por FZAC
        </span>
        <div className="product-card__price">
          <strong>{currency(product.price)}</strong>
          {product.compare_price ? <del>{currency(product.compare_price)}</del> : null}
        </div>
        <span className="product-card__finance">
          <CreditCard size={15} /> 3 cuotas de {currency(product.price / 3)}
        </span>
        <span className="product-card__stock">
          {product.stock > 0 ? `${product.stock} ${product.unit} disponibles` : "Sin stock"}
        </span>

        <div className="product-card__actions">
          <button className="btn" type="button" disabled={product.stock <= 0} onClick={() => addItem(product, 1)}>
            <ShoppingCart size={18} />
            Comprar
          </button>
          <Link className="icon-link" href={`/producto/${product.slug}`} aria-label={`Ver ${product.name}`}>
            <Eye size={18} />
          </Link>
        </div>
      </div>
    </article>
  );
}
