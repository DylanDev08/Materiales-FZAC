import { z } from "zod";
import { getApiAdmin } from "@/lib/auth/api-guards";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/utils/api";

const querySchema = z.object({
  status: z.string().trim().max(40).optional(),
  provider: z.string().trim().max(40).optional(),
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

  const { status, provider, page, per_page: perPage } = parsed.data;
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  let query = admin
    .from("payments")
    .select("id,order_id,provider,status,amount,currency,provider_preference_id,provider_payment_id,created_at,updated_at", {
      count: "exact"
    })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (status) query = query.eq("status", status);
  if (provider) query = query.eq("provider", provider);

  const { data: payments, count, error } = await query;
  if (error) return jsonError("No pudimos cargar pagos.", 400);

  const orderIds = (payments ?? []).map((payment) => payment.order_id).filter(Boolean);
  const { data: orders } = orderIds.length
    ? await admin.from("orders").select("id,customer_name,customer_email,total,status,created_at").in("id", orderIds)
    : { data: [] };

  return Response.json({
    payments: (payments ?? []).map((payment) => ({
      ...payment,
      order: (orders ?? []).find((order) => order.id === payment.order_id) ?? null
    })),
    pagination: { page, perPage, total: count ?? 0 }
  });
}
