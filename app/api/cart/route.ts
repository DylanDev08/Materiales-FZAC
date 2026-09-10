import { ZodError, z } from "zod";
import { getCurrentUser } from "@/lib/auth/get-user";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/utils/api";
import {
  acquireRequestConcurrency,
  getRequestKey,
  rateLimit,
  rateLimitIdentity,
  retryAfterHeaders
} from "@/lib/utils/rate-limit";
import { readLimitedJson } from "@/lib/utils/request-security";

const cartSchema = z.object({
  items: z
    .array(z.object({
      productId: z.string().uuid("Producto invalido."),
      quantity: z.coerce.number().int().min(1).max(999)
    }))
    .max(100, "El carrito supera el limite permitido.")
});

export async function GET(request: Request) {
  const limit = rateLimit(getRequestKey(request, "cart-read"), 90, 60_000);
  if (!limit.ok) return jsonError("Demasiadas consultas al carrito.", 429, retryAfterHeaders(limit));

  const user = await getCurrentUser();
  const admin = getSupabaseAdminClient();
  if (!user || !admin) return Response.json({ items: [] });

  const { data, error } = await admin
    .from("cart_items")
    .select("product_id, quantity, product:products(*)")
    .eq("user_id", user.id);

  if (error) return jsonError("No pudimos cargar el carrito.", 400);
  return Response.json({ items: data ?? [] });
}

export async function POST(request: Request) {
  const limit = rateLimit(getRequestKey(request, "cart-sync"), 30, 60_000);
  if (!limit.ok) return jsonError("Demasiadas actualizaciones del carrito.", 429, retryAfterHeaders(limit));
  const body = await readLimitedJson(request, 48 * 1024);
  if (!body.ok) return jsonError(body.message, body.status);

  const user = await getCurrentUser();
  const admin = getSupabaseAdminClient();
  if (!user || !admin) return Response.json({ ok: true, synced: false });

  const identityLimit = rateLimitIdentity("cart-sync", user.id, 45, 5 * 60_000);
  if (!identityLimit.ok) {
    return jsonError("Hiciste demasiados cambios en el carrito. Esperá un momento.", 429, retryAfterHeaders(identityLimit));
  }
  const slot = acquireRequestConcurrency(request, {
    scope: "cart-sync",
    identity: user.id,
    maxGlobal: 24,
    maxPerIp: 2,
    maxPerIdentity: 1,
    leaseMs: 10_000
  });
  if (!slot.ok) return jsonError("Ya estamos guardando tu carrito.", 429, retryAfterHeaders(slot));

  try {
    const payload = cartSchema.parse(body.data);
    const { data, error } = await admin.rpc("sync_user_cart", {
      p_user_id: user.id,
      p_items: payload.items.map((item) => ({ product_id: item.productId, quantity: item.quantity }))
    });
    if (error) {
      const detail = `${error.message ?? ""} ${error.details ?? ""}`;
      if (error.code === "PGRST202" || detail.includes("sync_user_cart")) {
        return jsonError("La base necesita aplicar la migracion de integridad antes de sincronizar el carrito.", 503);
      }
      return jsonError("No pudimos sincronizar el carrito.", 400);
    }

    return Response.json({
      ok: true,
      synced: true,
      stored: Number((data as { stored?: number } | null)?.stored ?? 0)
    });
  } catch (error) {
    if (error instanceof ZodError) return jsonError(error.issues[0]?.message ?? "Carrito invalido.", 422);
    return jsonError("No pudimos actualizar el carrito.", 400);
  } finally {
    slot.release();
  }
}
