import { getApiAdmin } from "@/lib/auth/api-guards";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/utils/api";

export async function GET() {
  const profile = await getApiAdmin();
  if (!profile) return jsonError("No autorizado.", 401);

  const admin = getSupabaseAdminClient();
  if (!admin) return jsonError("Backend administrativo no disponible.", 500);

  const [{ count: products }, { count: pending }, { count: tickets }, { count: customers }] = await Promise.all([
    admin.from("products").select("id", { count: "exact", head: true }).eq("active", true),
    admin.from("orders").select("id", { count: "exact", head: true }).eq("status", "PENDING_PAYMENT"),
    admin.from("purchase_tickets").select("id", { count: "exact", head: true }),
    admin.from("profiles").select("id", { count: "exact", head: true })
  ]);

  return Response.json({
    products: products ?? 0,
    pendingOrders: pending ?? 0,
    tickets: tickets ?? 0,
    customers: customers ?? 0
  });
}
