import { z } from "zod";
import { getUserProfile } from "@/lib/auth/get-user";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { toPublicPaymentSummary } from "@/lib/payments/dto";
import { jsonError } from "@/lib/utils/api";
import { getRequestKey, rateLimit, retryAfterHeaders } from "@/lib/utils/rate-limit";

const paramsSchema = z.object({
  id: z.string().uuid("Orden invalida.")
});

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile();
  if (!profile) return jsonError("Necesitas iniciar sesion.", 401);
  const limit = rateLimit(`${getRequestKey(request, "account-order-read")}:${profile.id}`, 45, 60_000);
  if (!limit.ok) return jsonError("Demasiadas consultas. Esperá un momento.", 429, retryAfterHeaders(limit));

  const admin = getSupabaseAdminClient();
  if (!admin) return jsonError("No pudimos cargar la orden en este momento.", 503);

  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) return jsonError(params.error.issues[0]?.message ?? "Orden invalida.", 422);

  let orderQuery = admin
    .from("orders")
    .select("id,status,customer_name,customer_email,customer_phone,shipping_method,shipping_cost,subtotal,total,address_snapshot,notes,paid_at,created_at,updated_at")
    .eq("id", params.data.id);
  if (profile.role !== "ADMIN") orderQuery = orderQuery.eq("user_id", profile.id);
  const { data: order, error } = await orderQuery.maybeSingle();
  if (error) return jsonError("No pudimos cargar la orden.", 400);
  if (!order) return jsonError("Orden no encontrada.", 404);

  const [{ data: items }, { data: payment }, { data: ticket }] = await Promise.all([
    admin
      .from("order_items")
      .select("id,order_id,product_id,sku,name,image_url,quantity,unit_price,subtotal,created_at")
      .eq("order_id", order.id)
      .order("created_at", { ascending: true }),
    admin
      .from("payments")
      .select("provider,status,amount,currency,updated_at")
      .eq("order_id", order.id)
      .maybeSingle(),
    admin
      .from("purchase_tickets")
      .select("id,number,order_id,customer_name,customer_email,customer_phone,payment_provider,subtotal,discount,shipping_cost,total,shipping_method,address_snapshot,notes,status,issued_at,created_at,updated_at")
      .eq("order_id", order.id)
      .maybeSingle()
  ]);

  const { data: ticketItems } = ticket?.id
    ? await admin
        .from("purchase_ticket_items")
        .select("id,ticket_id,product_id,sku,name,quantity,unit_price,subtotal,created_at")
        .eq("ticket_id", ticket.id)
        .order("created_at", { ascending: true })
    : { data: [] };

  return Response.json({
    order: {
      ...order,
      items: items ?? [],
      payment: toPublicPaymentSummary(payment as Record<string, unknown> | null),
      ticket: ticket ? { ...ticket, items: ticketItems ?? [] } : null
    }
  });
}
