import { z } from "zod";
import { getAdminApiContext } from "@/lib/auth/admin-api";
import { getSupplierWorkspace } from "@/lib/suppliers/workspace";
import { jsonError } from "@/lib/utils/api";

const querySchema = z.object({
  supplier: z.string().uuid().optional(),
  q: z.string().max(80).optional(),
  page: z.coerce.number().int().min(1).max(10000).optional()
});

export async function GET(request: Request) {
  const context = await getAdminApiContext(request, { scope: "admin-supplier-workspace-read", limit: 90 });
  if (!context.ok) return context.response;

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    supplier: url.searchParams.get("supplier") || undefined,
    q: url.searchParams.get("q") || undefined,
    page: url.searchParams.get("page") || undefined
  });
  if (!parsed.success) return jsonError("Filtros de proveedor inválidos.", 422);

  const data = await getSupplierWorkspace({
    supplierId: parsed.data.supplier,
    query: parsed.data.q,
    page: parsed.data.page
  });

  return Response.json(data, {
    headers: { "Cache-Control": "private, no-store, max-age=0, must-revalidate" }
  });
}
