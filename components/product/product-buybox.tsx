"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle, MessageCircle, Minus, Plus, ShieldCheck, ShoppingCart, Zap } from "lucide-react";
import { useCart } from "@/components/cart/cart-provider";
import { currency, percentOff } from "@/lib/formatters/currency";
import {
  canAddProductToCart,
  canPurchaseProduct,
  getProductAvailabilityStatus,
  productAvailabilityLabel
} from "@/lib/products/availability";
import { getWhatsAppHref } from "@/lib/utils/contact";
import { productLinePricing, promotionLabel } from "@/lib/products/promotions";
import { isWhatsAppOnlyProduct } from "@/lib/products/sales-channel";
import type { Product } from "@/types/domain";

export function ProductBuyBox({ product }: { product: Product }) {
  const router = useRouter();
  const { addItem, hydrated } = useCart();
  const purchasable = canPurchaseProduct(product);
  const cartEligible = canAddProductToCart(product);
  const availabilityStatus = getProductAvailabilityStatus(product);
  const [quantity, setQuantity] = useState(() => (cartEligible ? 1 : 0));
  const [added, setAdded] = useState(false);
  const [addError, setAddError] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const discount = percentOff(product.price, product.compare_price);
  const hasValidComparePrice = Boolean(product.compare_price && product.compare_price > product.price);
  const maxQuantity = availabilityStatus === "CONSULT" ? 999 : Math.max(1, product.stock);
  const pricing = productLinePricing(product, quantity);
  const subtotal = pricing.total;
  const promotion = promotionLabel(product);
  const normalizedBrand = product.brand.trim().toLowerCase();
  const displayBrand = ["sin marca informada", "sin marca", "generico", "genérico"].includes(normalizedBrand) ? "FZAC Materiales" : product.brand;
  const whatsappOnly = isWhatsAppOnlyProduct(product);
  const lowStockThreshold = Math.max(5, product.stock_minimum);
  const whatsappHref = getWhatsAppHref(
    whatsappOnly
      ? `Hola FZAC, quiero comprar ${quantity} ${quantity === 1 ? "combo" : "combos"} de ${product.name} (${product.sku}). Total promocional estimado: ${currency(pricing.total)}.`
      : availabilityStatus === "CONSULT"
        ? `Hola FZAC, quiero confirmar disponibilidad de ${quantity} ${product.unit} de ${product.name} (${product.sku}).`
        : `Hola FZAC, quiero consultar por ${product.name} (${product.sku}).`
  );

  function setSafeQuantity(next: number) {
    if (!cartEligible) {
      setQuantity(0);
      return;
    }
    setQuantity(Math.min(maxQuantity, Math.max(1, Number.isFinite(next) ? next : 1)));
    setAdded(false);
  }

  function addToCart() {
    if (!hydrated || isAdding || !cartEligible) return;
    setIsAdding(true);
    setAddError(false);
    const success = addItem(product, quantity);
    setAdded(success);
    setAddError(!success);
    window.requestAnimationFrame(() => setIsAdding(false));
  }

  function buyNow() {
    if (!hydrated || isAdding || !purchasable) return;
    setIsAdding(true);
    const success = addItem(product, quantity);
    setAdded(success);
    setAddError(!success);
    window.requestAnimationFrame(() => setIsAdding(false));
    if (success) router.push("/checkout");
  }

  return (
    <aside className="product-buybox">
      <span className="kicker">{displayBrand}</span>
      <h1>{product.name}</h1>
      <p className="product-buybox__meta">
        SKU {product.sku} - Categoría {product.category?.name ?? product.subcategory}
      </p>
      <p className="product-buybox__seller"><ShieldCheck size={16} /> Vendido y verificado por FZAC</p>

      <div className="product-price">
        <strong>{currency(product.price)}</strong>
        {hasValidComparePrice ? <del>{currency(product.compare_price!)}</del> : null}
        {promotion ? <span className="status-pill status-pill--warning">{promotion}</span> : null}
        {!promotion && discount ? <span className="status-pill status-pill--warning">-{discount}%</span> : null}
        <small className="product-price__unit">Precio por {product.unit}</small>
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
        {productAvailabilityLabel(product, { includeQuantity: availabilityStatus === "IN_STOCK" })}
      </span>
      {availabilityStatus === "IN_STOCK" && product.stock > 0 && product.stock <= lowStockThreshold ? (
        <span className="status-pill status-pill--warning">Últimas unidades</span>
      ) : null}

      {whatsappOnly ? (
        <>
          <div className="product-actions">
            <div className="quantity-stepper" aria-label="Cantidad">
              <button type="button" onClick={() => setSafeQuantity(quantity - 1)} disabled={quantity <= 1} aria-label="Restar una unidad"><Minus size={16} /></button>
              <input aria-label="Cantidad" min={1} max={maxQuantity} type="number" value={quantity || 1} onChange={(event) => setSafeQuantity(Number(event.target.value))} />
              <button type="button" onClick={() => setSafeQuantity(quantity + 1)} disabled={quantity >= maxQuantity} aria-label="Sumar una unidad"><Plus size={16} /></button>
            </div>
            <a className="btn" href={whatsappHref} target="_blank" rel="noreferrer"><MessageCircle size={18} /> Comprar por WhatsApp</a>
          </div>
          <p className="product-subtotal">Total estimado <strong>{currency(pricing.total)}</strong>{pricing.savings > 0 ? <small> Ahorrás {currency(pricing.savings)}.</small> : null}</p>
        </>
      ) : cartEligible ? (
        <>
          <div className="product-actions">
            <div className="quantity-stepper" aria-label="Cantidad">
              <button type="button" onClick={() => setSafeQuantity(quantity - 1)} disabled={quantity <= 1} aria-label="Restar una unidad"><Minus size={16} /></button>
              <input aria-label="Cantidad" min={1} max={maxQuantity} type="number" value={quantity} onChange={(event) => setSafeQuantity(Number(event.target.value))} />
              <button type="button" onClick={() => setSafeQuantity(quantity + 1)} disabled={quantity >= maxQuantity} aria-label="Sumar una unidad"><Plus size={16} /></button>
            </div>
            <button className="btn" type="button" disabled={!hydrated || isAdding} onClick={addToCart}><ShoppingCart size={18} />{!hydrated ? "Cargando..." : isAdding ? "Añadiendo..." : "Añadir al carrito"}</button>
          </div>

          <p className="product-subtotal">Total estimado <strong>{currency(subtotal)}</strong>{pricing.savings > 0 ? <small> Ahorrás {currency(pricing.savings)} con la promoción.</small> : null}</p>

          {availabilityStatus === "IN_STOCK" && quantity >= product.stock && product.stock > 0 ? <p className="notice">Estás seleccionando el máximo disponible.</p> : null}
          {availabilityStatus === "CONSULT" ? <p className="notice">Podés agregar la cantidad que necesitás. FZAC confirma la disponibilidad final por WhatsApp antes del pago.</p> : null}
        </>
      ) : (
        <p className="notice">{availabilityStatus === "CONSULT" ? "Stock a confirmar antes del pago." : "Sin stock por el momento. Consultanos por reposición o alternativas."}</p>
      )}

      {added ? (
        <div className="product-added-toast" role="status" aria-live="polite">
          <strong><CheckCircle size={18} /> Producto añadido al carrito</strong>
          <span>{product.name} · Cantidad: {quantity}</span>
          <div><Link className="btn" href="/carrito" prefetch={false}>Ver carrito</Link><Link className="btn btn--ghost" href="/productos" prefetch={false}>Seguir comprando</Link></div>
        </div>
      ) : null}

      {addError ? (
        <div className="product-added-toast product-added-toast--error" role="alert" aria-live="assertive">
          <strong><AlertCircle size={18} /> El producto no se pudo añadir</strong>
          <span>Volvé a intentarlo o consultanos si el problema continúa.</span>
        </div>
      ) : null}

      {purchasable && !whatsappOnly ? (
        <button className="btn btn--ghost" type="button" onClick={buyNow} disabled={!hydrated || isAdding}><Zap size={18} />{hydrated ? "Comprar ahora" : "Cargando carrito"}</button>
      ) : null}

      <a className="btn btn--ghost" href={whatsappHref} target="_blank" rel="noreferrer"><MessageCircle size={18} />{availabilityStatus === "CONSULT" ? "Confirmar stock por WhatsApp" : "Consultar por WhatsApp"}</a>

      <div className="product-buybox__trust">
        <span>Retiro en FZAC</span>
        <span>Envío según zona</span>
        <span>{availabilityStatus === "IN_STOCK" ? "Stock disponible" : availabilityStatus === "CONSULT" ? "Stock a confirmar" : "Consultá reposición"}</span>
      </div>
    </aside>
  );
}
