"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  MessageCircle,
  Minus,
  PackageOpen,
  Plus,
  ShieldCheck,
  Trash2
} from "lucide-react";
import { useCart } from "@/components/cart/cart-provider";
import { currency } from "@/lib/formatters/currency";
import { getWhatsAppHref } from "@/lib/utils/contact";
import type { Product } from "@/types/domain";

type CartValidationState =
  | { status: "idle" | "loading" | "ok" }
  | { status: "error"; message: string; items: Array<{ productId: string; requested: number; available: number; name?: string }> };

export function CartPage() {
  const { hydrated, items, subtotal, updateQuantity, removeItem, clearCart, refreshProducts } = useCart();
  const [message, setMessage] = useState("");
  const [validation, setValidation] = useState<CartValidationState>({ status: "idle" });
  const lastValidationRef = useRef("");
  const helpHref = getWhatsAppHref("Hola FZAC, necesito ayuda para revisar mi carrito antes de comprar.");
  const cartFingerprint = useMemo(
    () => items.map((item) => `${item.productId}:${item.quantity}`).sort().join("|"),
    [items]
  );

  useEffect(() => {
    if (!hydrated || !items.length || lastValidationRef.current === cartFingerprint) return;
    lastValidationRef.current = cartFingerprint;
    const controller = new AbortController();

    void (async () => {
      setValidation({ status: "loading" });
      try {
        const response = await fetch("/api/cart/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: items.map((item) => ({ product_id: item.productId, quantity: item.quantity })) }),
          signal: controller.signal
        });
        const data = (await response.json()) as {
          message?: string;
          items?: Array<{ productId: string; requested: number; available: number; name?: string }>;
          products?: Array<{ product: Product; quantity: number }>;
        };

        if (data.products?.length) refreshProducts(data.products.map((item) => item.product));
        if (!response.ok) {
          setValidation({
            status: "error",
            message: data.message || "Revisá el stock antes de continuar.",
            items: data.items ?? []
          });
          return;
        }
        setValidation({ status: "ok" });
      } catch (error) {
        if (controller.signal.aborted) return;
        lastValidationRef.current = "";
        setValidation({
          status: "error",
          message: error instanceof Error ? "No pudimos actualizar el stock. Reintentá en unos segundos." : "No pudimos validar el carrito.",
          items: []
        });
      }
    })();

    return () => controller.abort();
  }, [cartFingerprint, hydrated, items, refreshProducts]);

  if (!hydrated) {
    return (
      <main className="page-section">
        <div className="container empty-state">
          <div>
            <PackageOpen size={38} />
            <h1>Cargando carrito</h1>
            <p>Estamos preparando tus productos guardados.</p>
          </div>
        </div>
      </main>
    );
  }

  if (!items.length) {
    return (
      <main className="page-section">
        <div className="container empty-state">
          <div>
            <PackageOpen size={38} />
            <h1>Tu carrito está vacío</h1>
            <p>Agregá materiales del catálogo para iniciar una compra.</p>
            <Link className="btn" href="/productos">
              Ver productos
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page-section">
      <div className="container">
        <div className="section-head">
          <div>
            <span className="kicker">Carrito</span>
            <h1>Revisá tus materiales</h1>
            <p>Las cantidades y el stock final se validan nuevamente antes de crear la orden.</p>
          </div>
        </div>

        <div className="cart-layout">
          <section className="cart-lines">
            <div className={`cart-validation cart-validation--${validation.status}`} role="status" aria-live="polite">
              {validation.status === "loading" ? (
                <Loader2 size={18} />
              ) : validation.status === "ok" ? (
                <CheckCircle2 size={18} />
              ) : validation.status === "error" ? (
                <AlertTriangle size={18} />
              ) : (
                <ShieldCheck size={18} />
              )}
              <div>
                <strong>
                  {validation.status === "loading"
                    ? "Actualizando precios y stock"
                    : validation.status === "ok"
                      ? "Carrito validado con el catálogo actual"
                      : validation.status === "error"
                        ? "El carrito necesita revisión"
                        : "Validación pendiente"}
                </strong>
                <span>
                  {validation.status === "error"
                    ? validation.message
                    : "La validación definitiva se repite al crear el pedido."}
                </span>
              </div>
            </div>
            {items.map((item) => {
              const issue =
                validation.status === "error"
                  ? validation.items.find((candidate) => candidate.productId === item.productId)
                  : null;
              return (
                <article className={`cart-line ${issue ? "cart-line--warning" : ""}`} key={item.productId}>
                  <Image src={item.product.image_url} alt={item.product.name} width={96} height={96} />
                  <div className="cart-line__details">
                    <h3>{item.product.name}</h3>
                    <p className="cart-line__meta">
                      {item.product.sku} - {currency(item.product.price)} por {item.product.unit}
                    </p>
                    <span className={`cart-line__stock ${item.product.stock > 0 && !issue ? "is-ok" : "is-warning"}`}>
                      {issue
                        ? `Pediste ${issue.requested}; disponibles ${issue.available}`
                        : `${item.product.stock} ${item.product.unit} disponibles`}
                    </span>
                    <div className="cart-line__actions">
                      <div className="quantity-control" aria-label={`Cantidad de ${item.product.name}`}>
                        <button
                          type="button"
                          disabled={item.quantity <= 1}
                          onClick={() => {
                            updateQuantity(item.productId, item.quantity - 1);
                            setMessage("Producto actualizado.");
                          }}
                          aria-label={`Restar una unidad de ${item.product.name}`}
                        >
                          <Minus size={15} />
                        </button>
                        <strong>{item.quantity}</strong>
                        <button
                          type="button"
                          disabled={item.product.stock <= 0 || item.quantity >= item.product.stock}
                          onClick={() => {
                            if (item.quantity >= item.product.stock) {
                              setMessage(`Solo quedan ${item.product.stock} unidades disponibles.`);
                              return;
                            }
                            updateQuantity(item.productId, item.quantity + 1);
                            setMessage("Producto actualizado.");
                          }}
                          aria-label={`Sumar una unidad de ${item.product.name}`}
                        >
                          <Plus size={15} />
                        </button>
                      </div>
                      <button
                        className="cart-remove"
                        type="button"
                        onClick={() => {
                          removeItem(item.productId);
                          setMessage("Producto eliminado.");
                        }}
                      >
                        <Trash2 size={15} />
                        Quitar
                      </button>
                    </div>
                  </div>
                  <div className="cart-line__price">
                    <span>Subtotal</span>
                    <strong>{currency(item.product.price * item.quantity)}</strong>
                  </div>
                </article>
              );
            })}
            {message ? <p className="notice notice--success">{message}</p> : null}
          </section>

          <aside className="checkout-summary">
            <h2>Resumen</h2>
            <div className="summary-line">
              <span>Subtotal</span>
              <strong>{currency(subtotal)}</strong>
            </div>
            <div className="summary-line">
              <span>Envío</span>
              <strong>Se define en checkout</strong>
            </div>
            <div className="summary-total">
              <span>Total parcial</span>
              <strong>{currency(subtotal)}</strong>
            </div>
            <div className="cart-summary-actions">
              {validation.status === "ok" ? (
                <Link className="btn" href="/checkout">
                  Continuar al checkout
                </Link>
              ) : (
                <span className="btn is-disabled" aria-disabled="true">
                  {validation.status === "loading" ? "Validando carrito..." : "Revisar stock para continuar"}
                </span>
              )}
              <Link className="btn btn--ghost" href="/productos">
                Continuar comprando
              </Link>
              <a className="checkout-help-link" href={helpHref} target="_blank" rel="noreferrer">
                <MessageCircle size={17} />
                Necesito ayuda
              </a>
              <button
                className="btn btn--ghost"
                type="button"
                onClick={() => {
                  clearCart();
                  setMessage("Carrito vacío.");
                }}
              >
                Vaciar carrito
              </button>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
