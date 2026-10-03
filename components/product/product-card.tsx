"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { AlertCircle, ArrowRight, CheckCircle, MessageCircle, Minus, Plus, ShieldCheck, ShoppingCart } from "lucide-react";
import { useCart } from "@/components/cart/cart-provider";
import { currency, percentOff } from "@/lib/formatters/currency";
import {
  canAddProductToCart,
  canPurchaseProduct,
  getProductAvailabilityStatus,
  productAvailabilityLabel
} from "@/lib/products/availability";
import { productLinePricing, promotionLabel } from "@/lib/products/promotions";
import { isWhatsAppOnlyProduct } from "@/lib/products/sales-channel";
import { getWhatsAppHref } from "@/lib/utils/contact";
import type { Product } from "@/types/domain";

export function ProductCard({ product }: { product: Product }) {
  const { addItem, hydrated } = useCart();
  const [isAdding, setIsAdding] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [addError, setAddError] = useState(false);
  const discount = percentOff(product.price, product.compare_price);
  const hasValidComparePrice = Boolean(product.compare_price && product.compare_price > product.price);
  const availabilityStatus = getProductAvailabilityStatus(product);
  const purchasable = canPurchaseProduct(product);
  const cartEligible = canAddProductToCart(product);
  const availabilityLabel = productAvailabilityLabel(product, { includeQuantity: true });
  const hasProductImage = Boolean(product.image_url?.trim());
  const imageSrc = hasProductImage ? product.image_url.trim() : "/logoFZAC.jpg";
  const promotion = promotionLabel(product);
  const whatsappOnly = isWhatsAppOnlyProduct(product);
  const maxQuantity = purchasable ? product.stock : whatsappOnly ? Math.max(product.stock, 1) : 999;
  const pricing = productLinePricing(product, quantity);
  const whatsappHref = getWhatsAppHref(
    `Hola FZAC, quiero comprar ${quantity} ${quantity === 1 ? "unidad" : "unidades"} de ${product.name}. Total estimado: ${currency(pricing.total)}. Quiero coordinar el pago inmediato por WhatsApp.`
  );

  function setSafeQuantity(next: number) {
    setQuantity(Math.min(maxQuantity, Math.max(1, Number.isFinite(next) ? next : 1)));
    setAdded(false);
    setAddError(false);
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

  useEffect(() => {
    if (!added && !addError) return;
    const timer = window.setTimeout(() => {
      setAdded(false);
      setAddError(false);
    }, 2600);
    return () => window.clearTimeout(timer);
  }, [added, addError]);

  return (
    <article className="product-card">
      <Link className="product-card__media" href={`/producto/${product.slug}`} prefetch={false}>
        <Image
          src={imageSrc}
          alt={product.name}
          fill
          sizes="(max-width: 400px) 100vw, (max-width: 820px) 50vw, (max-width: 1200px) 25vw, 220px"
        />
        <div className="product-card__badges">
          {!hasProductImage ? <span className="status-pill product-card__image-pending">Imagen pendiente</span> : null}
          {promotion ? <span className="status-pill status-pill--warning">{promotion}</span> : null}
          {!promotion && discount ? <span className="status-pill status-pill--warning">{discount}% OFF</span> : null}
          {purchasable && product.stock <= product.stock_minimum ? (
            <span className="status-pill status-pill--danger">Stock bajo</span>
          ) : null}
          {availabilityStatus === "CONSULT" ? (
            <span className="status-pill status-pill--warning product-card__availability-consult">Stock a confirmar</span>
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
        <p className="product-card__description">{product.description}</p>
        <span className="product-card__seller">Vendido por FZAC</span>
        <div className="product-card__price">
          <strong>{currency(product.price)}</strong>
          {hasValidComparePrice ? <del>{currency(product.compare_price!)}</del> : null}
        </div>
        <span className="product-card__unit">Precio por {product.unit}</span>
        <span
          className={`product-card__stock ${
            availabilityStatus === "OUT_OF_STOCK"
              ? "product-card__stock--empty"
              : availabilityStatus === "CONSULT"
                ? "product-card__stock--consult"
                : ""
          }`}
        >
          {availabilityLabel}
        </span>
        <span className="product-card__finance">
          {whatsappOnly ? (
            <><MessageCircle size={14} /> Venta y pago coordinados por WhatsApp</>
          ) : purchasable ? (
            <><ShieldCheck size={14} /> Pago seguro y stock validado</>
          ) : (
            <><MessageCircle size={14} /> Confirmamos stock antes del pago</>
          )}
        </span>

        {(cartEligible || whatsappOnly) ? (
          <div className="product-card__quantity" aria-label="Cantidad">
            <button type="button" onClick={() => setSafeQuantity(quantity - 1)} disabled={quantity <= 1} aria-label="Restar una unidad">
              <Minus size={14} />
            </button>
            <input
              aria-label="Cantidad"
              min={1}
              max={maxQuantity}
              type="number"
              value={quantity}
              onChange={(event) => setSafeQuantity(Number(event.target.value))}
            />
            <button type="button" onClick={() => setSafeQuantity(quantity + 1)} disabled={quantity >= maxQuantity} aria-label="Sumar una unidad">
              <Plus size={14} />
            </button>
          </div>
        ) : null}

        <div className="product-card__actions">
          {whatsappOnly ? (
            <a className="btn" href={whatsappHref} target="_blank" rel="noreferrer">
              <MessageCircle size={18} />
              Comprar por WhatsApp
            </a>
          ) : cartEligible ? (
            <button className="btn product-card__primary-action" type="button" disabled={!hydrated || isAdding} onClick={addToCart}>
              <ShoppingCart size={18} />
              {!hydrated ? "Cargando..." : isAdding ? "Añadiendo..." : "Añadir al carrito"}
            </button>
          ) : (
            <Link className="btn" href={`/producto/${product.slug}`} prefetch={false}>
              <MessageCircle size={18} />
              {availabilityStatus === "CONSULT" ? "Ver producto" : "Ver alternativas"}
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
              <CheckCircle size={15} /> Producto añadido al carrito
            </strong>
            <small>
              {product.name} · Cantidad {quantity}
            </small>
            <span>
              <Link href="/carrito" prefetch={false}>Ver carrito</Link>
              <Link href="/productos" prefetch={false}>Seguir comprando</Link>
            </span>
          </div>
        ) : null}
        {addError ? (
          <div className="product-card__toast product-card__toast--error" role="alert" aria-live="assertive">
            <strong><AlertCircle size={15} /> El producto no se pudo añadir</strong>
            <small>Volvé a intentarlo o consultanos si el problema continúa.</small>
          </div>
        ) : null}
      </div>
    </article>
  );
}
