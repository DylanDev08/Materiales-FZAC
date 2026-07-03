import { adminProductSchema } from "@/lib/validations/admin";
import { getApiAdmin } from "@/lib/auth/api-guards";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/utils/api";

export async function GET() {
  const profile = await getApiAdmin();
  if (!profile) return jsonError("No autorizado.", 401);

  const admin = getSupabaseAdminClient();
  if (!admin) return jsonError("Backend administrativo no disponible.", 500);

  const { data, error } = await admin.from("products").select("*").order("created_at", { ascending: false });
  if (error) return jsonError("No pudimos cargar productos.", 400);
  return Response.json({ products: data ?? [] });
}

export async function POST(request: Request) {
  const profile = await getApiAdmin();
  if (!profile) return jsonError("No autorizado.", 401);

  const admin = getSupabaseAdminClient();
  if (!admin) return jsonError("Backend administrativo no disponible.", 500);

  const payload = adminProductSchema.parse(await request.json());
  const insert = { ...payload };
  delete insert.id;
  const { data, error } = await admin.from("products").insert(insert).select("*").single();
  if (error) return jsonError("No pudimos crear el producto. Revisa SKU, slug, categoria y valores cargados.", 400);

  await admin.from("admin_audit_logs").insert({
    actor_id: profile.id,
    actor_email: profile.email,
    action: "PRODUCT_CREATED",
    entity: "products",
    entity_id: data.id,
    message: `Producto creado: ${data.name}`
  });

  return Response.json({ product: data });
}

export async function PATCH(request: Request) {
  const profile = await getApiAdmin();
  if (!profile) return jsonError("No autorizado.", 401);

  const admin = getSupabaseAdminClient();
  if (!admin) return jsonError("Backend administrativo no disponible.", 500);

  const payload = adminProductSchema.parse(await request.json());
  if (!payload.id) return jsonError("Falta id de producto.", 422);

  const { id, ...update } = payload;
  const { data, error } = await admin
    .from("products")
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();

  if (error) return jsonError("No pudimos actualizar el producto. Revisa SKU, slug, categoria y valores cargados.", 400);

  await admin.from("admin_audit_logs").insert({
    actor_id: profile.id,
    actor_email: profile.email,
    action: "PRODUCT_UPDATED",
    entity: "products",
    entity_id: data.id,
    message: `Producto actualizado: ${data.name}`
  });

  return Response.json({ product: data });
}

export async function DELETE(request: Request) {
  const profile = await getApiAdmin();
  if (!profile) return jsonError("No autorizado.", 401);

  const admin = getSupabaseAdminClient();
  if (!admin) return jsonError("Backend administrativo no disponible.", 500);

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return jsonError("Falta id.", 422);

  const { error } = await admin.from("products").update({ active: false, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return jsonError("No pudimos desactivar el producto.", 400);

  await admin.from("admin_audit_logs").insert({
    actor_id: profile.id,
    actor_email: profile.email,
    action: "PRODUCT_DEACTIVATED",
    entity: "products",
    entity_id: id,
    message: "Producto desactivado"
  });

  return Response.json({ ok: true });
}
