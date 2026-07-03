import { z } from "zod";
import { getUserProfile } from "@/lib/auth/get-user";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/utils/api";

const paramsSchema = z.object({
  id: z.string().uuid("Orden invalida.")
});

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile();
  if (!profile) return jsonError("Necesitas iniciar sesion.", 401);

  const admin = getSupabaseAdminClient();
  if (!admin) return jsonError("No pudimos cargar la orden en este momento.", 503);

  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) return jsonError(params.error.issues[0]?.message ?? "Orden invalida.", 422);

  const { data: order, error } = await admin.from("orders").select("*").eq("id", params.data.id).maybeSingle();
  if (error) return jsonError("No pudimos cargar la orden.", 400);
  if (!order) return jsonError("Orden no encontrada.", 404);

  const ownsOrder =
    order.user_id === profile.id || String(order.customer_email).toLowerCase() === profile.email.toLowerCase();
  if (profile.role !== "ADMIN" && !ownsOrder) return jsonError("No autorizado.", 403);

  const [{ data: items }, { data: payment }, { data: ticket }] = await Promise.all([
    admin.from("order_items").select("*").eq("order_id", order.id).order("created_at", { ascending: true }),
    admin
      .from("payments")
      .select("id,order_id,provider,status,amount,currency,provider_preference_id,provider_payment_id,created_at,updated_at")
      .eq("order_id", order.id)
      .maybeSingle(),
    admin.from("purchase_tickets").select("*").eq("order_id", order.id).maybeSingle()
  ]);

  const { data: ticketItems } = ticket?.id
    ? await admin.from("purchase_ticket_items").select("*").eq("ticket_id", ticket.id).order("created_at", { ascending: true })
    : { data: [] };

  return Response.json({
    order: {
      ...order,
      items: items ?? [],
      payment: payment ?? null,
      ticket: ticket ? { ...ticket, items: ticketItems ?? [] } : null
    }
  });
}
