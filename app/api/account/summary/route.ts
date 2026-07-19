import { getUserProfile } from "@/lib/auth/get-user";
import { getAccountOverview } from "@/lib/db/account";
import { jsonError } from "@/lib/utils/api";
import { getRequestKey, rateLimit, retryAfterHeaders } from "@/lib/utils/rate-limit";

export async function GET(request: Request) {
  const limit = rateLimit(getRequestKey(request, "account-summary"), 30, 60_000);
  if (!limit.ok) return jsonError("Demasiadas consultas de cuenta.", 429, retryAfterHeaders(limit));

  const profile = await getUserProfile();
  if (!profile) return jsonError("Necesitás iniciar sesión.", 401);

  const overview = await getAccountOverview(profile);
  return Response.json({
    totalSpent: overview.totalSpent,
    pendingAmount: overview.pendingAmount,
    ordersCount: overview.ordersCount,
    purchasedProducts: overview.purchasedProducts,
    reservedProducts: overview.reservedProducts
  });
}
