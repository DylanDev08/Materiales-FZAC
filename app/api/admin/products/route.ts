import { ZodError, z } from "zod";
import { adminProductSchema } from "@/lib/validations/admin";
import { getAdminApiContext } from "@/lib/auth/admin-api";
import { jsonError } from "@/lib/utils/api";
import { invalidateAssistantCatalogCache } from "@/lib/assistant/catalog-intelligence";
import { isTrustedMutationRequest, validateJsonMutationRequest } from "@/lib/utils/request-security";

const productIdSchema = z.string().uuid("Producto inválido.");

function productValidationError(error: unknown) {
  if (error instanceof ZodError) return jsonError(error.issues[0]?.message ?? "Revisá los datos del producto.", 422);
  if (error instanceof SyntaxError) return jsonError("El contenido enviado no es válido.", 400);
  return null;
}

export async function GET(request: Request) {
  const context = await getAdminApiContext(request, { scope: "admin-products-read", limit: 90 });
  if (!context.ok) return context.response;
  const { admin } = context;

  const { data, error } = await admin.from("products").select("*").order("created_at", { ascending: false });
  if (error) return jsonError("No pudimos cargar productos.", 400);
  return Response.json({ products: data ?? [] });
}

export async function POST(request: Request) {
  const mutation = validateJsonMutationRequest(request, 32 * 1024);
  if (!mutation.ok) return jsonError(mutation.message, mutation.status);
  const context = await getAdminApiContext(request, { scope: "admin-products-create", limit: 20 });
  if (!context.ok) return context.response;
  const { admin, profile } = context;

  try {
    const payload = adminProductSchema.parse(await request.json());
    const insert = { ...payload };
    delete insert.id;
    const { data, error } = await admin.from("products").insert(insert).select("*").single();
    if (error) return jsonError("No pudimos crear el producto. Revisá SKU, slug, categoría y valores cargados.", 409);
    invalidateAssistantCatalogCache();

    await admin.from("admin_audit_logs").insert({
      actor_id: profile.id,
      actor_email: profile.email,
      actor_role: profile.role,
      action: "PRODUCT_CREATED",
      entity: "products",
      entity_id: data.id,
      message: `Producto creado: ${data.name}`
    });

    return Response.json({ product: data }, { status: 201 });
  } catch (error) {
    return productValidationError(error) ?? jsonError("No pudimos crear el producto.", 500);
  }
}

export async function PATCH(request: Request) {
  const mutation = validateJsonMutationRequest(request, 32 * 1024);
  if (!mutation.ok) return jsonError(mutation.message, mutation.status);
  const context = await getAdminApiContext(request, { scope: "admin-products-update", limit: 30 });
  if (!context.ok) return context.response;
  const { admin, profile } = context;

  try {
    const payload = adminProductSchema.parse(await request.json());
    if (!payload.id) return jsonError("Falta el producto a modificar.", 422);

    const { id, ...update } = payload;
    const { data, error } = await admin
      .from("products")
      .update({ ...update, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();

    if (error) return jsonError("No pudimos actualizar el producto. Revisá SKU, slug, categoría y valores cargados.", 409);
    invalidateAssistantCatalogCache();

    await admin.from("admin_audit_logs").insert({
      actor_id: profile.id,
      actor_email: profile.email,
      actor_role: profile.role,
      action: "PRODUCT_UPDATED",
      entity: "products",
      entity_id: data.id,
      message: `Producto actualizado: ${data.name}`
    });

    return Response.json({ product: data });
  } catch (error) {
    return productValidationError(error) ?? jsonError("No pudimos actualizar el producto.", 500);
  }
}

export async function DELETE(request: Request) {
  if (!isTrustedMutationRequest(request)) return jsonError("Origen de solicitud no permitido.", 403);
  const context = await getAdminApiContext(request, { scope: "admin-products-deactivate", limit: 20 });
  if (!context.ok) return context.response;
  const { admin, profile } = context;

  const id = productIdSchema.safeParse(new URL(request.url).searchParams.get("id"));
  if (!id.success) return jsonError(id.error.issues[0]?.message ?? "Producto inválido.", 422);

  const { data, error } = await admin
    .from("products")
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq("id", id.data)
    .eq("active", true)
    .select("id,name")
    .maybeSingle();
  if (error) return jsonError("No pudimos desactivar el producto.", 400);
  if (!data) return jsonError("El producto no existe o ya estaba desactivado.", 409);
  invalidateAssistantCatalogCache();

  await admin.from("admin_audit_logs").insert({
    actor_id: profile.id,
    actor_email: profile.email,
    actor_role: profile.role,
    action: "PRODUCT_DEACTIVATED",
    entity: "products",
    entity_id: id.data,
    message: `Producto desactivado: ${data.name}`
  });

  return Response.json({ ok: true });
}
