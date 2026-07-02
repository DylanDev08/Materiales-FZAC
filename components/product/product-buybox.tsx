"use client";

import { useState } from "react";
import Link from "next/link";
import { ShoppingCart, Zap } from "lucide-react";
import { useCart } from "@/components/cart/cart-provider";
import { currency, percentOff } from "@/lib/formatters/currency";
import type { Product } from "@/types/domain";

export function ProductBuyBox({ product }: { product: Product }) {
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const discount = percentOff(product.price, product.compare_price);

  return (
    <aside className="product-buybox">
      <span className="kicker">{product.brand}</span>
      <h1>{product.name}</h1>
      <p>
        SKU {product.sku} · Categoria {product.category?.name ?? product.subcategory}
      </p>

      <div className="product-price">
        <strong>{currency(product.price)}</strong>
        {product.compare_price ? <del>{currency(product.compare_price)}</del> : null}
        {discount ? <span className="status-pill status-pill--warning">-{discount}%</span> : null}
      </div>

      <span className={product.stock > 0 ? "status-pill status-pill--success" : "status-pill status-pill--danger"}>
        {product.stock > 0 ? `${product.stock} ${product.unit} disponibles` : "Sin stock"}
      </span>

      <div className="product-actions">
        <input
          aria-label="Cantidad"
          min={1}
          max={product.stock}
          type="number"
          value={quantity}
          onChange={(event) => setQuantity(Number(event.target.value))}
        />
        <button className="btn" type="button" disabled={product.stock <= 0} onClick={() => addItem(product, quantity)}>
          <ShoppingCart size={18} />
          Agregar al carrito
        </button>
      </div>

      <Link className="btn btn--ghost" href="/checkout" onClick={() => addItem(product, quantity)}>
        <Zap size={18} />
        Comprar ahora
      </Link>

      <p>
        Medios de pago por Mercado Pago. No solicitamos ni guardamos datos de tarjeta en FZAC.
      </p>
    </aside>
  );
}
