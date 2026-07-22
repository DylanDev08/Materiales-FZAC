import { ZodError, z } from "zod";
import { getCurrentUser } from "@/lib/auth/get-user";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/utils/api";
import { getRequestKey, rateLimit, retryAfterHeaders } from "@/lib/utils/rate-limit";
import { isSafeUserNote, normalizeUserNote } from "@/lib/validations/security";

const addressFields = {
  label: z.string().trim().min(2, "Ingresá un nombre para la dirección.").max(50),
  street: z.string().trim().min(2, "Ingresá la calle.").max(120),
  number: z.string().trim().min(1, "Ingresá la altura.").max(30),
  apartment: z.string().trim().max(60).optional().or(z.literal("")),
  city: z.string().trim().min(2, "Ingresá la ciudad.").max(80),
  province: z.string().trim().min(2, "Ingresá la provincia.").max(80),
  postalCode: z.string().trim().max(30).optional().or(z.literal("")),
  notes: z
    .string()
    .transform((value) => normalizeUserNote(value, 240))
    .refine((value) => value.length <= 240, "Las indicaciones son demasiado largas.")
    .refine((value) => isSafeUserNote(value), "Las indicaciones contienen caracteres no permitidos.")
    .optional()
    .or(z.literal(""))
};

const addressSchema = z.object(addressFields);
const updateSchema = addressSchema.extend({ id: z.string().uuid("Dirección inválida.") });
const deleteSchema = z.object({ id: z.string().uuid("Dirección inválida.") });

function row(userId: string, payload: z.infer<typeof addressSchema>) {
  return {
    user_id: userId,
    label: payload.label,
    street: payload.street,
    number: payload.number,
    apartment: payload.apartment || null,
    city: payload.city,
    province: payload.province,
    postal_code: payload.postalCode || null,
    notes: payload.notes || null,
    updated_at: new Date().toISOString()
  };
}

async function context(request: Request, scope: string) {
  const limit = rateLimit(getRequestKey(request, scope), 20, 60_000);
  if (!limit.ok) return { response: jsonError("Demasiadas actualizaciones. Probá nuevamente en un minuto.", 429, retryAfterHeaders(limit)) };
  const user = await getCurrentUser();
  if (!user) return { response: jsonError("Necesitás iniciar sesión.", 401) };
  const admin = getSupabaseAdminClient();
  if (!admin) return { response: jsonError("No pudimos acceder a tus direcciones.", 503) };
  return { user, admin };
}

export async function POST(request: Request) {
  const current = await context(request, "account-address-create");
  if ("response" in current) return current.response;

  try {
    const payload = addressSchema.parse(await request.json());
    const { count } = await current.admin
      .from("addresses")
      .select("id", { count: "exact", head: true })
      .eq("user_id", current.user.id);
    if ((count ?? 0) >= 8) return jsonError("Podés guardar hasta 8 direcciones.", 409);

    const { data, error } = await current.admin
      .from("addresses")
      .insert(row(current.user.id, payload))
      .select("id")
      .single();
    if (error || !data) return jsonError("No pudimos guardar la dirección.", 400);
    return Response.json({ ok: true, id: data.id }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) return jsonError(error.issues[0]?.message ?? "Dirección inválida.", 422);
    return jsonError("No pudimos guardar la dirección.", 500);
  }
}

export async function PATCH(request: Request) {
  const current = await context(request, "account-address-update");
  if ("response" in current) return current.response;

  try {
    const payload = updateSchema.parse(await request.json());
    const { error, count } = await current.admin
      .from("addresses")
      .update(row(current.user.id, payload), { count: "exact" })
      .eq("id", payload.id)
      .eq("user_id", current.user.id);
    if (error || count !== 1) return jsonError("No encontramos esa dirección en tu cuenta.", 404);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError) return jsonError(error.issues[0]?.message ?? "Dirección inválida.", 422);
    return jsonError("No pudimos actualizar la dirección.", 500);
  }
}

export async function DELETE(request: Request) {
  const current = await context(request, "account-address-delete");
  if ("response" in current) return current.response;

  try {
    const payload = deleteSchema.parse(await request.json());
    const { error, count } = await current.admin
      .from("addresses")
      .delete({ count: "exact" })
      .eq("id", payload.id)
      .eq("user_id", current.user.id);
    if (error || count !== 1) return jsonError("No encontramos esa dirección en tu cuenta.", 404);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError) return jsonError(error.issues[0]?.message ?? "Dirección inválida.", 422);
    return jsonError("No pudimos eliminar la dirección.", 500);
  }
}
