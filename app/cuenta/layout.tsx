import type { Metadata } from "next";
import { privatePageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = privatePageMetadata(
  "Mi cuenta",
  "Gestioná tus datos, direcciones, pedidos y conversaciones."
);

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return children;
}
