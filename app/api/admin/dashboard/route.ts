import { getAdminApiContext } from "@/lib/auth/admin-api";
import { getAdminDashboardData } from "@/lib/db/admin";
import { jsonError } from "@/lib/utils/api";

const allowedPeriods = new Set(["day", "week", "month"]);

export async function GET(request: Request) {
  const context = await getAdminApiContext(request, { scope: "admin-dashboard-read", limit: 90 });
  if (!context.ok) return context.response;

  const url = new URL(request.url);
  const rawPeriod = url.searchParams.get("period") ?? "month";
  if (!allowedPeriods.has(rawPeriod)) return jsonError("Periodo invalido.", 422);

  const data = await getAdminDashboardData(rawPeriod as "day" | "week" | "month");
  return Response.json(data, {
    headers: { "Cache-Control": "private, no-store, max-age=0, must-revalidate" }
  });
}
