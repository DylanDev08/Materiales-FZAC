import type { Metadata } from "next";
import { CartPage } from "@/components/cart/cart-page";
import { privatePageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = privatePageMetadata(
  "Carrito",
  "Revisá los productos y cantidades antes de continuar con tu compra."
);

export default function Page() {
  return <CartPage />;
}
