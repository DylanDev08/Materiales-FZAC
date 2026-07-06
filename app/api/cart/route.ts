import { ZodError, z } from "zod";
import { getCurrentUser } from "@/lib/auth/get-user";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/utils/api";
import { getRequestKey, rateLimit } from "@/lib/utils/rate-limit";

const cartSchema = z.object({
  items: z.array(z.object({ productId: z.string().min(1), quantity: z.coerce.number().int().min(1).max(999) }))
});
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const limit = rateLimit(getRequestKey(request, "cart-read"), 90, 60_000);
  if (!limit.ok) return jsonError("Demasiadas consultas al carrito.", 429);

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
  const limit = rateLimit(getRequestKey(request, "cart-sync"), 45, 60_000);
  if (!limit.ok) return jsonError("Demasiadas actualizaciones del carrito.", 429);

  const user = await getCurrentUser();
  const admin = getSupabaseAdminClient();
  if (!user || !admin) return Response.json({ ok: true, synced: false });

  try {
    const payload = cartSchema.parse(await request.json());
    const rows = payload.items
      .filter((item) => UUID_PATTERN.test(item.productId))
      .map((item) => ({
        user_id: user.id,
        product_id: item.productId,
        quantity: item.quantity,
        updated_at: new Date().toISOString()
      }));

    if (rows.length) {
      const { error } = await admin.from("cart_items").upsert(rows, { onConflict: "user_id,product_id" });
      if (error) return jsonError("No pudimos sincronizar el carrito.", 400);
    }

    return Response.json({ ok: true, synced: true });
  } catch (error) {
    if (error instanceof ZodError) return jsonError(error.issues[0]?.message ?? "Carrito invalido.", 422);
    return jsonError("No pudimos actualizar el carrito.", 400);
  }
}
