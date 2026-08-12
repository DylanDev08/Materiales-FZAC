import { ZodError } from "zod";
import { getAdminApiContext } from "@/lib/auth/admin-api";
import { jsonError } from "@/lib/utils/api";
import { validateJsonMutationRequest } from "@/lib/utils/request-security";
import { bulkVoidFinancialMovementsSchema } from "@/lib/validations/admin";

const MAX_BULK_VOID = 250;

export async function PATCH(request: Request) {
  const mutation = validateJsonMutationRequest(request, 8 * 1024);
  if (!mutation.ok) return jsonError(mutation.message, mutation.status);
  const context = await getAdminApiContext(request, {
    scope: "admin-financial-bulk-void",
    limit: 3,
    windowMs: 10 * 60_000
  });
  if (!context.ok) return context.response;
  const { admin, profile } = context;

  try {
    const payload = bulkVoidFinancialMovementsSchema.parse(await request.json());
    const before = new Date(payload.before);
    const { data, error } = await admin.rpc("admin_bulk_void_financial_movements", {
      p_actor_id: profile.id,
      p_actor_email: profile.email,
      p_type: payload.type,
      p_before: before.toISOString(),
      p_reason: payload.reason,
      p_max_rows: MAX_BULK_VOID
    });

    if (error) {
      if (error.message.includes("NO_ELIGIBLE_MOVEMENTS")) {
        return jsonError("No hay movimientos manuales vigentes para ese criterio.", 409);
      }
      if (error.message.includes("TOO_MANY_MOVEMENTS")) {
        return jsonError(`La selección supera ${MAX_BULK_VOID} registros. Elegí una fecha más acotada.`, 422);
      }
      if (/function .*admin_bulk_void_financial_movements.*does not exist/i.test(error.message)) {
        return jsonError("Aplicá la migración de mantenimiento antes de usar esta operación.", 503);
      }
      return jsonError("No pudimos anular la selección. Ningún comprobante fue eliminado.", 409);
    }
    const result = (data ?? {}) as { count?: number };
    const count = Number(result.count ?? 0);

    return Response.json({ ok: true, count, message: `${count} movimientos anulados. La trazabilidad se conservó.` });
  } catch (error) {
    if (error instanceof ZodError) return jsonError(error.issues[0]?.message ?? "Revisá los criterios.", 422);
    if (error instanceof SyntaxError) return jsonError("El contenido enviado no es válido.", 400);
    return jsonError("No pudimos completar la operación de mantenimiento.", 500);
  }
}
