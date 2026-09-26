import { z } from "zod";
import { getAdminApiContext } from "@/lib/auth/admin-api";
import { getCatalogProfitabilityReport } from "@/lib/analytics/catalog-profitability-report";
import { jsonError } from "@/lib/utils/api";

const querySchema = z.object({
  period: z.enum(["day", "week", "month"]).default("month"),
  scope: z.enum(["all", "sold", "issues"]).default("all")
});

export async function GET(request: Request) {
  const context = await getAdminApiContext(request, { scope: "admin-catalog-report-read", limit: 60 });
  if (!context.ok) return context.response;

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    period: url.searchParams.get("period") || "month",
    scope: url.searchParams.get("scope") || "all"
  });
  if (!parsed.success) return jsonError("Parámetros de reporte inválidos.", 422);

  const data = await getCatalogProfitabilityReport(parsed.data.period, parsed.data.scope);
  return Response.json(data, {
    headers: { "Cache-Control": "private, no-store, max-age=0, must-revalidate" }
  });
}
