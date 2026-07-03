import { z } from "zod";
import { getApiAdmin } from "@/lib/auth/api-guards";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/utils/api";

const querySchema = z.object({
  status: z.string().trim().max(40).optional(),
  email: z.string().trim().max(160).optional(),
  date_from: z.string().trim().max(40).optional(),
  date_to: z.string().trim().max(40).optional(),
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(25)
});

export async function GET(request: Request) {
  const profile = await getApiAdmin();
  if (!profile) return jsonError("No autorizado.", 401);

  const admin = getSupabaseAdminClient();
  if (!admin) return jsonError("Backend administrativo no disponible.", 500);

  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return jsonError("Filtros invalidos.", 422);

  const { status, email, date_from: dateFrom, date_to: dateTo, page, per_page: perPage } = parsed.data;
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  let query = admin.from("orders").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(from, to);
  if (status) query = query.eq("status", status);
  if (email) query = query.ilike("customer_email", `%${email}%`);
  if (dateFrom) query = query.gte("created_at", dateFrom);
  if (dateTo) query = query.lte("created_at", dateTo);

  const { data: orders, count, error } = await query;
  if (error) return jsonError("No pudimos cargar pedidos.", 400);

  const orderIds = (orders ?? []).map((order) => order.id);
  const [{ data: items }, { data: payments }, { data: tickets }] = orderIds.length
    ? await Promise.all([
        admin.from("order_items").select("*").in("order_id", orderIds),
        admin
          .from("payments")
          .select("id,order_id,provider,status,amount,currency,provider_preference_id,provider_payment_id,created_at,updated_at")
          .in("order_id", orderIds),
        admin.from("purchase_tickets").select("id,order_id,number,status,issued_at,total").in("order_id", orderIds)
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  return Response.json({
    orders: (orders ?? []).map((order) => ({
      ...order,
      items: (items ?? []).filter((item) => item.order_id === order.id),
      payment: (payments ?? []).find((payment) => payment.order_id === order.id) ?? null,
      ticket: (tickets ?? []).find((ticket) => ticket.order_id === order.id) ?? null
    })),
    pagination: { page, perPage, total: count ?? 0 }
  });
}
