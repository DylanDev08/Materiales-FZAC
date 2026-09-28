import { z } from "zod";
import { getAdminApiContext } from "@/lib/auth/admin-api";
import { jsonError } from "@/lib/utils/api";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(300).default(200)
});

export async function GET(request: Request) {
  const context = await getAdminApiContext(request, { scope: "admin-tickets-read", limit: 90 });
  if (!context.ok) return context.response;

  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return jsonError("Filtros inválidos.", 422);

  const { data, error } = await context.admin
    .from("purchase_tickets")
    .select("id,number,order_id,customer_name,customer_email,total,status,issued_at,created_at")
    .order("issued_at", { ascending: false })
    .limit(parsed.data.limit);

  if (error) return jsonError("No pudimos cargar tickets.", 400);

  return Response.json(
    { tickets: data ?? [] },
    { headers: { "Cache-Control": "private, no-store, max-age=0, must-revalidate" } }
  );
}
