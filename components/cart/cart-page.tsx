"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { MessageCircle, Minus, PackageOpen, Plus, Trash2 } from "lucide-react";
import { useCart } from "@/components/cart/cart-provider";
import { currency } from "@/lib/formatters/currency";
import { getWhatsAppHref } from "@/lib/utils/contact";

export function CartPage() {
  const { hydrated, items, subtotal, updateQuantity, removeItem, clearCart } = useCart();
  const [message, setMessage] = useState("");
  const helpHref = getWhatsAppHref("Hola FZAC, necesito ayuda para revisar mi carrito antes de comprar.");

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
            {items.map((item) => (
              <article className="cart-line" key={item.productId}>
                <Image src={item.product.image_url} alt={item.product.name} width={96} height={96} />
                <div className="cart-line__details">
                  <h3>{item.product.name}</h3>
                  <p className="cart-line__meta">
                    {item.product.sku} - {currency(item.product.price)} por {item.product.unit}
                  </p>
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
                        disabled={item.quantity >= item.product.stock}
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
            ))}
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
              <strong>Se coordina por WhatsApp</strong>
            </div>
            <div className="summary-total">
              <span>Total parcial</span>
              <strong>{currency(subtotal)}</strong>
            </div>
            <div className="cart-summary-actions">
              <Link className="btn" href="/checkout">
                Continuar al checkout
              </Link>
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
