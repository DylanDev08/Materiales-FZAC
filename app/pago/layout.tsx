import type { Metadata } from "next";
import { privatePageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = privatePageMetadata(
  "Estado del pago",
  "Consulta privada del estado de una operación de Materiales FZAC."
);

export default function PaymentResultLayout({ children }: { children: React.ReactNode }) {
  return children;
}
