"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/components/cart/cart-provider";

export function CartStatus() {
  const { count } = useCart();

  return (
    <Link className="icon-link" href="/carrito" aria-label="Abrir carrito" prefetch={false}>
      <ShoppingCart size={20} />
      {count > 0 ? <span className="icon-link__badge">{count}</span> : null}
    </Link>
  );
}
