"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { resolveProductImageUrl } from "@/lib/products/images";
import type { CartLine, Product } from "@/types/domain";

type CartContextValue = {
  items: CartLine[];
  count: number;
  subtotal: number;
  hydrated: boolean;
  addItem: (product: Product, quantity?: number) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "fzac-cart-v1";

function sanitize(items: CartLine[]) {
  return items
    .filter((item) => item.product?.id && item.quantity > 0)
    .map((item) => {
      const available = Number.isFinite(Number(item.product.stock)) ? Number(item.product.stock) : 999;
      return {
        ...item,
        product: { ...item.product, image_url: resolveProductImageUrl(item.product) },
        quantity: Math.min(available, Math.max(1, Number(item.quantity)))
      };
    })
    .filter((item) => item.quantity > 0);
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;

    window.queueMicrotask(() => {
      if (!active) return;
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        setItems(raw ? sanitize(JSON.parse(raw) as CartLine[]) : []);
      } catch {
        setItems([]);
      } finally {
        setHydrated(true);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [hydrated, items]);

  useEffect(() => {
    if (!hydrated || items.length === 0) return;

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;

      await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((item) => ({ productId: item.productId, quantity: item.quantity }))
        })
      }).catch(() => null);
    });
  }, [hydrated, items]);

  const value = useMemo<CartContextValue>(() => {
    const count = items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

    return {
      items,
      count,
      subtotal,
      hydrated,
      addItem(product, quantity = 1) {
        setItems((current) => {
          const existing = current.find((item) => item.productId === product.id);
          if (!existing) return sanitize([...current, { productId: product.id, quantity, product }]);

          return sanitize(
            current.map((item) =>
              item.productId === product.id ? { ...item, product, quantity: item.quantity + quantity } : item
            )
          );
        });
      },
      updateQuantity(productId, quantity) {
        setItems((current) =>
          sanitize(current.map((item) => (item.productId === productId ? { ...item, quantity } : item)))
        );
      },
      removeItem(productId) {
        setItems((current) => current.filter((item) => item.productId !== productId));
      },
      clearCart() {
        setItems([]);
      }
    };
  }, [hydrated, items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart debe usarse dentro de CartProvider.");
  return context;
}
