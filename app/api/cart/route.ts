import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/get-user";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/utils/api";

const cartSchema = z.object({
  items: z.array(z.object({ productId: z.string().min(1), quantity: z.coerce.number().int().min(1).max(999) }))
});

export async function GET() {
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
  const user = await getCurrentUser();
  const admin = getSupabaseAdminClient();
  if (!user || !admin) return Response.json({ ok: true, synced: false });

  const payload = cartSchema.parse(await request.json());
  const rows = payload.items.map((item) => ({
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
}
