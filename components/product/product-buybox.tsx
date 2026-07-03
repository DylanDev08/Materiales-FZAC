"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle, Minus, Plus, ShoppingCart, Zap } from "lucide-react";
import { useCart } from "@/components/cart/cart-provider";
import { currency, percentOff } from "@/lib/formatters/currency";
import type { Product } from "@/types/domain";

export function ProductBuyBox({ product }: { product: Product }) {
  const router = useRouter();
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(() => (product.stock > 0 ? 1 : 0));
  const [added, setAdded] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const discount = percentOff(product.price, product.compare_price);
  const maxQuantity = product.stock;
  const subtotal = product.price * quantity;
  const lowStockThreshold = 5;

  function setSafeQuantity(next: number) {
    if (product.stock <= 0) {
      setQuantity(0);
      return;
    }
    setQuantity(Math.min(maxQuantity, Math.max(1, Number.isFinite(next) ? next : 1)));
    setAdded(false);
  }

  function addToCart() {
    if (isAdding || product.stock <= 0) return;
    setIsAdding(true);
    addItem(product, quantity);
    setAdded(true);
    window.requestAnimationFrame(() => setIsAdding(false));
  }

  function buyNow() {
    if (isAdding || product.stock <= 0) return;
    setIsAdding(true);
    addItem(product, quantity);
    setAdded(true);
    window.requestAnimationFrame(() => setIsAdding(false));
    router.push("/checkout");
  }

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
      {product.stock > 0 && product.stock <= lowStockThreshold ? (
        <span className="status-pill status-pill--warning">Ultimas unidades</span>
      ) : null}

      <div className="product-actions">
        <div className="quantity-stepper" aria-label="Cantidad">
          <button type="button" onClick={() => setSafeQuantity(quantity - 1)} disabled={quantity <= 1}>
            <Minus size={16} />
          </button>
          <input
            aria-label="Cantidad"
            min={product.stock > 0 ? 1 : 0}
            max={product.stock}
            type="number"
            value={quantity}
            disabled={product.stock <= 0}
            onChange={(event) => setSafeQuantity(Number(event.target.value))}
          />
          <button type="button" onClick={() => setSafeQuantity(quantity + 1)} disabled={product.stock <= 0 || quantity >= maxQuantity}>
            <Plus size={16} />
          </button>
        </div>
        <button className="btn" type="button" disabled={product.stock <= 0 || isAdding} onClick={addToCart}>
          <ShoppingCart size={18} />
          {isAdding ? "Agregando..." : "Agregar al carrito"}
        </button>
      </div>

      <p className="product-subtotal">
        Total estimado <strong>{currency(subtotal)}</strong>
      </p>

      {quantity >= product.stock && product.stock > 0 ? <p className="notice">Estas seleccionando el maximo disponible.</p> : null}

      {added ? (
        <div className="notice notice--success product-added">
          <strong>
            <CheckCircle size={18} /> Tu producto fue agregado
          </strong>
          <div>
            <Link className="btn" href="/carrito">
              Ver carrito
            </Link>
            <Link className="btn btn--ghost" href="/productos">
              Seguir comprando
            </Link>
          </div>
        </div>
      ) : null}

      <button className="btn btn--ghost" type="button" onClick={buyNow} disabled={product.stock <= 0 || isAdding}>
        <Zap size={18} />
        Comprar ahora
      </button>

      <p>
        Medios de pago por Mercado Pago. No solicitamos ni guardamos datos de tarjeta en FZAC.
      </p>
    </aside>
  );
}
