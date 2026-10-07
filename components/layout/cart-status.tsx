"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/components/cart/cart-provider";
import { currency } from "@/lib/formatters/currency";

export function CartStatus() {
  const { count, subtotal } = useCart();

  return (
    <Link className="icon-link header-action-link" href="/carrito" aria-label={count > 0 ? `Abrir carrito: ${count} unidades, subtotal ${currency(subtotal)}` : "Abrir carrito"} prefetch={false}>
      <ShoppingCart size={20} />
      <span className="header-action-copy"><small>{count > 0 ? `${count} ${count === 1 ? "unidad" : "unidades"}` : "Tu compra"}</small><strong>{count > 0 ? currency(subtotal) : "Carrito"}</strong></span>
      {count > 0 ? <span className="icon-link__badge">{count}</span> : null}
    </Link>
  );
}
