import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OrderConfirmed } from "@/components/checkout/order-confirmed";
import { getUserProfile } from "@/lib/auth/get-user";
import { privatePageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = privatePageMetadata(
  "Pedido confirmado",
  "Tu pedido quedó registrado y listo para coordinar con FZAC por WhatsApp."
);

export default async function Page({ searchParams }: { searchParams: Promise<{ orderId?: string }> }) {
  const profile = await getUserProfile();
  if (!profile) redirect("/login?next=/checkout");

  const { orderId } = await searchParams;
  if (!orderId?.trim()) redirect("/cuenta/pedidos");

  return <OrderConfirmed orderId={orderId.trim()} />;
}
