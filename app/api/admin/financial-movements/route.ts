import { ZodError } from "zod";
import { getApiAdmin } from "@/lib/auth/api-guards";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/utils/api";
import { getRequestKey, rateLimit, retryAfterHeaders } from "@/lib/utils/rate-limit";
import { validateJsonMutationRequest } from "@/lib/utils/request-security";
import { financialMovementSchema, voidFinancialMovementSchema } from "@/lib/validations/admin";

async function context(request: Request, scope: string, limitValue: number) {
  const profile = await getApiAdmin();
  if (!profile) return { response: jsonError("No autorizado.", 403) };
  const limit = rateLimit(`${getRequestKey(request, scope)}:${profile.id}`, limitValue, 60_000);
  if (!limit.ok) return { response: jsonError("Demasiadas operaciones. Probá nuevamente en un minuto.", 429, retryAfterHeaders(limit)) };
  const admin = getSupabaseAdminClient();
  if (!admin) return { response: jsonError("Backend administrativo no disponible.", 503) };
  return { profile, admin };
}

export async function POST(request: Request) {
  const mutation = validateJsonMutationRequest(request, 8 * 1024);
  if (!mutation.ok) return jsonError(mutation.message, mutation.status);
  const current = await context(request, "admin-financial-create", 12);
  if ("response" in current) return current.response;

  try {
    const payload = financialMovementSchema.parse(await request.json());
    const { data, error } = await current.admin
      .from("financial_movements")
      .insert({
        type: payload.type,
        category: payload.category,
        description: payload.description,
        amount: payload.amount,
        occurred_at: payload.occurred_at,
        source: "MANUAL",
        status: "ACTIVE",
        created_by: current.profile.id
      })
      .select("id")
      .single();

    if (error || !data) return jsonError("No pudimos registrar el movimiento. Verificá que la migración financiera esté aplicada.", 409);

    await current.admin.from("admin_audit_logs").insert({
      actor_id: current.profile.id,
      actor_email: current.profile.email,
      actor_role: current.profile.role,
      action: "FINANCIAL_MOVEMENT_CREATED",
      entity: "financial_movements",
      entity_id: data.id,
      message: `${payload.type === "INCOME" ? "Ingreso" : "Egreso"} administrativo registrado: ${payload.description}.`,
      metadata: { category: payload.category, amount: payload.amount, occurred_at: payload.occurred_at }
    });

    return Response.json({ ok: true, id: data.id }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) return jsonError(error.issues[0]?.message ?? "Revisá los datos.", 422);
    if (error instanceof SyntaxError) return jsonError("El contenido enviado no es válido.", 400);
    return jsonError("No pudimos registrar el movimiento.", 500);
  }
}

export async function PATCH(request: Request) {
  const mutation = validateJsonMutationRequest(request, 8 * 1024);
  if (!mutation.ok) return jsonError(mutation.message, mutation.status);
  const current = await context(request, "admin-financial-void", 8);
  if ("response" in current) return current.response;

  try {
    const payload = voidFinancialMovementSchema.parse(await request.json());
    const now = new Date().toISOString();
    const { data, error } = await current.admin
      .from("financial_movements")
      .update({
        status: "VOID",
        voided_by: current.profile.id,
        voided_at: now,
        void_reason: payload.reason,
        updated_at: now
      })
      .eq("id", payload.id)
      .eq("status", "ACTIVE")
      .select("id")
      .maybeSingle();

    if (error || !data) return jsonError("El movimiento no existe o ya fue anulado.", 409);

    await current.admin.from("admin_audit_logs").insert({
      actor_id: current.profile.id,
      actor_email: current.profile.email,
      actor_role: current.profile.role,
      action: "FINANCIAL_MOVEMENT_VOIDED",
      entity: "financial_movements",
      entity_id: data.id,
      message: "Movimiento financiero anulado.",
      metadata: { reason: payload.reason }
    });

    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError) return jsonError(error.issues[0]?.message ?? "Revisá los datos.", 422);
    if (error instanceof SyntaxError) return jsonError("El contenido enviado no es válido.", 400);
    return jsonError("No pudimos anular el movimiento.", 500);
  }
}
