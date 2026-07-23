import { z, ZodError } from "zod";
import { getApiAdmin } from "@/lib/auth/api-guards";
import { consumerRefundStatusEmailTemplate } from "@/lib/email/templates";
import { isResendConfigured, sendTransactionalEmail } from "@/lib/email/resend";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/utils/api";
import { getSiteUrl } from "@/lib/utils/env";
import { getRequestKey, rateLimit, retryAfterHeaders } from "@/lib/utils/rate-limit";
import { isTrustedMutationRequest } from "@/lib/utils/request-security";
import { isSafeUserNote, normalizeUserNote } from "@/lib/validations/security";

const paramsSchema = z.object({ id: z.string().uuid("Solicitud inválida.") });
const bodySchema = z.object({
  status: z.enum(["RECEIVED", "IN_REVIEW", "APPROVED", "REJECTED", "CLOSED"]),
  resolutionNote: z
    .string()
    .transform((value) => normalizeUserNote(value, 500))
    .refine(isSafeUserNote, "La nota contiene caracteres no permitidos.")
});

const statusLabels: Record<z.infer<typeof bodySchema>["status"], string> = {
  RECEIVED: "Recibida",
  IN_REVIEW: "En revisión",
  APPROVED: "Aprobada para gestión",
  REJECTED: "Rechazada",
  CLOSED: "Cerrada"
};

const resolvedStatuses = new Set(["APPROVED", "REJECTED", "CLOSED"]);

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isTrustedMutationRequest(request)) return jsonError("Origen de solicitud no permitido.", 403);

  const profile = await getApiAdmin();
  if (!profile) return jsonError("No autorizado.", 403);

  const limit = rateLimit(`${getRequestKey(request, "admin-consumer-request")}:${profile.id}`, 20, 60_000);
  if (!limit.ok) return jsonError("Demasiados cambios seguidos. Esperá un minuto.", 429, retryAfterHeaders(limit));

  const admin = getSupabaseAdminClient();
  if (!admin) return jsonError("Backend administrativo no disponible.", 503);

  try {
    const params = paramsSchema.parse(await context.params);
    const payload = bodySchema.parse(await request.json());
    if (resolvedStatuses.has(payload.status) && payload.resolutionNote.trim().length < 10) {
      return jsonError("Explicá brevemente la resolución antes de cerrar o aprobar la solicitud.", 422);
    }

    const { data: current, error: currentError } = await admin
      .from("consumer_refund_requests")
      .select("id,request_number,user_id,order_number,full_name,email,status,resolution_note")
      .eq("id", params.id)
      .maybeSingle();
    if (currentError) return jsonError("No pudimos revisar la solicitud.", 400);
    if (!current) return jsonError("Solicitud no encontrada.", 404);

    const note = payload.resolutionNote.trim() || null;
    if (current.status === payload.status && String(current.resolution_note ?? "") === String(note ?? "")) {
      return Response.json({ ok: true, message: "La solicitud ya tenía ese estado." });
    }

    const now = new Date().toISOString();
    const isResolved = resolvedStatuses.has(payload.status);
    const { error: updateError } = await admin
      .from("consumer_refund_requests")
      .update({
        status: payload.status,
        resolution_note: note,
        resolved_at: isResolved ? now : null,
        resolved_by: isResolved ? profile.id : null,
        updated_at: now
      })
      .eq("id", params.id);
    if (updateError) return jsonError("No pudimos actualizar la solicitud.", 400);

    try {
      await admin.from("admin_audit_logs").insert({
        actor_id: profile.id,
        actor_email: profile.email,
        actor_role: profile.role,
        action: "CONSUMER_REQUEST_STATUS_UPDATED",
        entity: "consumer_refund_requests",
        entity_id: params.id,
        message: `${profile.email} cambió el trámite ${current.request_number} a ${statusLabels[payload.status]}.`,
        metadata: { previous_status: current.status, next_status: payload.status }
      });
    } catch {
      // El cambio principal ya quedó persistido; la auditoría puede revisarse por separado.
    }

    if (current.user_id) {
      try {
        await admin.from("notifications").insert({
          user_id: current.user_id,
          target_role: "USER",
          type: "CONSUMER_REQUEST_UPDATED",
          title: "Actualizamos tu solicitud",
          message: `El trámite ${current.request_number} ahora está: ${statusLabels[payload.status]}.`,
          link_to: "/cuenta"
        });
      } catch {
        // El email es un segundo canal y el estado permanece visible para administración.
      }
    }

    let emailSent = false;
    if (isResendConfigured()) {
      try {
        const template = consumerRefundStatusEmailTemplate({
          name: current.full_name,
          requestNumber: current.request_number,
          orderNumber: current.order_number,
          status: statusLabels[payload.status],
          resolutionNote: note,
          actionUrl: new URL(current.user_id ? "/cuenta/solicitudes" : "/arrepentimiento", getSiteUrl()).toString()
        });
        await sendTransactionalEmail({ to: { email: current.email, name: current.full_name }, ...template });
        emailSent = true;
      } catch {
        emailSent = false;
      }
    }

    return Response.json({
      ok: true,
      email_sent: emailSent,
      message: emailSent
        ? "Estado actualizado y constancia enviada al cliente."
        : "Estado actualizado. La constancia por email quedó pendiente."
    });
  } catch (error) {
    if (error instanceof ZodError) return jsonError(error.issues[0]?.message ?? "Revisá los datos ingresados.", 422);
    return jsonError("No pudimos actualizar la solicitud.", 500);
  }
}
