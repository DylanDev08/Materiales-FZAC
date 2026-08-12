import { getAdminApiContext } from "@/lib/auth/admin-api";

export async function GET(request: Request) {
  const context = await getAdminApiContext(request, { scope: "admin-metrics", limit: 90 });
  if (!context.ok) return context.response;
  const { admin } = context;

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
