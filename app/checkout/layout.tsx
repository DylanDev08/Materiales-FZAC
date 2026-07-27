import type { Metadata } from "next";
import { privatePageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = privatePageMetadata(
  "Compra segura",
  "Flujo privado de compra y confirmación de pago de Materiales FZAC."
);

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
