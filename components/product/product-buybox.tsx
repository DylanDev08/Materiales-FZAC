"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle, MessageCircle, Minus, Plus, ShieldCheck, ShoppingCart, Zap } from "lucide-react";
import { useCart } from "@/components/cart/cart-provider";
import { currency, percentOff } from "@/lib/formatters/currency";
import {
  canPurchaseProduct,
  getProductAvailabilityStatus,
  productAvailabilityLabel
} from "@/lib/products/availability";
import { getWhatsAppHref } from "@/lib/utils/contact";
import type { Product } from "@/types/domain";

export function ProductBuyBox({ product }: { product: Product }) {
  const router = useRouter();
  const { addItem, hydrated } = useCart();
  const purchasable = canPurchaseProduct(product);
  const availabilityStatus = getProductAvailabilityStatus(product);
  const [quantity, setQuantity] = useState(() => (purchasable ? 1 : 0));
  const [added, setAdded] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const discount = percentOff(product.price, product.compare_price);
  const hasValidComparePrice = Boolean(product.compare_price && product.compare_price > product.price);
  const maxQuantity = purchasable ? product.stock : 0;
  const subtotal = product.price * quantity;
  const lowStockThreshold = Math.max(5, product.stock_minimum);
  const whatsappHref = getWhatsAppHref(`Hola FZAC, quiero consultar disponibilidad de ${product.name} (${product.sku}).`);

  function setSafeQuantity(next: number) {
    if (!purchasable) {
      setQuantity(0);
      return;
    }
    setQuantity(Math.min(maxQuantity, Math.max(1, Number.isFinite(next) ? next : 1)));
    setAdded(false);
  }

  function addToCart() {
    if (!hydrated || isAdding || !purchasable) return;
    setIsAdding(true);
    addItem(product, quantity);
    setAdded(true);
    window.requestAnimationFrame(() => setIsAdding(false));
  }

  function buyNow() {
    if (!hydrated || isAdding || !purchasable) return;
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
      <p className="product-buybox__meta">
        SKU {product.sku} - Categoría {product.category?.name ?? product.subcategory}
      </p>
      <p className="product-buybox__seller"><ShieldCheck size={16} /> Vendido y verificado por FZAC</p>

      <div className="product-price">
        <strong>{currency(product.price)}</strong>
        {hasValidComparePrice ? <del>{currency(product.compare_price!)}</del> : null}
        {discount ? <span className="status-pill status-pill--warning">-{discount}%</span> : null}
      </div>

      <span
        className={
          availabilityStatus === "IN_STOCK"
            ? "status-pill status-pill--success"
            : availabilityStatus === "CONSULT"
              ? "status-pill status-pill--warning"
              : "status-pill status-pill--danger"
        }
      >
        {productAvailabilityLabel(product, { includeQuantity: true })}
      </span>
      {purchasable && product.stock <= lowStockThreshold ? (
        <span className="status-pill status-pill--warning">Últimas unidades</span>
      ) : null}

      {purchasable ? (
        <>
          <div className="product-actions">
            <div className="quantity-stepper" aria-label="Cantidad">
              <button type="button" onClick={() => setSafeQuantity(quantity - 1)} disabled={quantity <= 1} aria-label="Restar una unidad">
                <Minus size={16} />
              </button>
              <input
                aria-label="Cantidad"
                min={1}
                max={product.stock}
                type="number"
                value={quantity}
                onChange={(event) => setSafeQuantity(Number(event.target.value))}
              />
              <button type="button" onClick={() => setSafeQuantity(quantity + 1)} disabled={quantity >= maxQuantity} aria-label="Sumar una unidad">
                <Plus size={16} />
              </button>
            </div>
            <button className="btn" type="button" disabled={!hydrated || isAdding} onClick={addToCart}>
              <ShoppingCart size={18} />
              {!hydrated ? "Cargando..." : isAdding ? "Agregando..." : "Agregar al carrito"}
            </button>
          </div>

          <p className="product-subtotal">
            Total estimado <strong>{currency(subtotal)}</strong>
          </p>

          {quantity >= product.stock && product.stock > 0 ? <p className="notice">Estás seleccionando el máximo disponible.</p> : null}
        </>
      ) : (
        <p className="notice">
          {availabilityStatus === "CONSULT"
            ? "Este producto tiene precio publicado, pero FZAC debe confirmar disponibilidad antes de crear una compra. Consultanos y coordinamos cantidad, retiro o envío."
            : "Este producto no tiene stock confirmado para compra directa. Podés consultarnos por reposición o alternativas."}
        </p>
      )}

      {added ? (
        <div className="product-added-toast" role="status" aria-live="polite">
          <strong>
            <CheckCircle size={18} /> Producto agregado al carrito
          </strong>
          <span>
            {product.name} · Cantidad: {quantity}
          </span>
          <div>
            <Link className="btn" href="/carrito" prefetch={false}>
              Ver carrito
            </Link>
            <Link className="btn btn--ghost" href="/productos" prefetch={false}>
              Seguir comprando
            </Link>
          </div>
        </div>
      ) : null}

      {purchasable ? (
        <button className="btn btn--ghost" type="button" onClick={buyNow} disabled={!hydrated || isAdding}>
          <Zap size={18} />
          {hydrated ? "Comprar ahora" : "Cargando carrito"}
        </button>
      ) : null}

      <a className="btn btn--ghost" href={whatsappHref} target="_blank" rel="noreferrer">
        <MessageCircle size={18} />
        {availabilityStatus === "CONSULT" ? "Consultar disponibilidad por WhatsApp" : "Consultar por WhatsApp"}
      </a>

      <div className="product-buybox__trust">
        <span>Retiro coordinado</span>
        <span>Envío a cotizar</span>
        <span>{purchasable ? "Pago y stock verificados" : "Disponibilidad validada antes de vender"}</span>
      </div>
    </aside>
  );
}
