"use client";

import Link from "next/link";
import Image from "next/image";
import { Minus, PackageOpen, Plus, Trash2 } from "lucide-react";
import { useCart } from "@/components/cart/cart-provider";
import { currency } from "@/lib/formatters/currency";

export function CartPage() {
  const { items, subtotal, updateQuantity, removeItem } = useCart();

  if (!items.length) {
    return (
      <main className="page-section">
        <div className="container empty-state">
          <div>
            <PackageOpen size={38} />
            <h1>Tu carrito esta vacio</h1>
            <p>Agrega materiales del catalogo para iniciar una compra.</p>
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
            <h1>Revisa tus materiales</h1>
            <p>Las cantidades y el stock final se validan nuevamente antes de crear la orden.</p>
          </div>
        </div>

        <div className="cart-layout">
          <section className="cart-lines">
            {items.map((item) => (
              <article className="cart-line" key={item.productId}>
                <Image src={item.product.image_url} alt={item.product.name} width={96} height={96} />
                <div>
                  <h3>{item.product.name}</h3>
                  <p>
                    {item.product.sku} · {currency(item.product.price)} por {item.product.unit}
                  </p>
                  <div className="quantity-control" aria-label={`Cantidad de ${item.product.name}`}>
                    <button type="button" onClick={() => updateQuantity(item.productId, item.quantity - 1)}>
                      <Minus size={15} />
                    </button>
                    <strong>{item.quantity}</strong>
                    <button type="button" onClick={() => updateQuantity(item.productId, item.quantity + 1)}>
                      <Plus size={15} />
                    </button>
                    <button type="button" onClick={() => removeItem(item.productId)} aria-label="Eliminar">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                <strong>{currency(item.product.price * item.quantity)}</strong>
              </article>
            ))}
          </section>

          <aside className="checkout-summary">
            <h2>Resumen</h2>
            <div className="summary-line">
              <span>Subtotal</span>
              <strong>{currency(subtotal)}</strong>
            </div>
            <div className="summary-line">
              <span>Envio</span>
              <strong>Se calcula en checkout</strong>
            </div>
            <div className="summary-total">
              <span>Total parcial</span>
              <strong>{currency(subtotal)}</strong>
            </div>
            <Link className="btn" href="/checkout">
              Continuar al checkout
            </Link>
          </aside>
        </div>
      </div>
    </main>
  );
}
