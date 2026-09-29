import { redirect } from "next/navigation";

export default async function Page({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    const current = Array.isArray(value) ? value[0] : value;
    if (current) query.set(key, current);
  }

  const legacyOrderId = query.get("orderId");
  if (legacyOrderId && !query.get("order_id")) {
    query.set("order_id", legacyOrderId);
  }

  redirect(`/pago/aprobado?${query.toString()}`);
}
