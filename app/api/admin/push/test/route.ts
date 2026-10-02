import { getAdminApiContext } from "@/lib/auth/admin-api";
import { sendAdminWebPush } from "@/lib/notifications/web-push";
import { jsonError } from "@/lib/utils/api";
import { validateJsonMutationRequest } from "@/lib/utils/request-security";
import { getAdminConsolePath } from "@/lib/utils/env";

export async function POST(request: Request) {
  const mutation = validateJsonMutationRequest(request, 2 * 1024);
  if (!mutation.ok) return jsonError(mutation.message, mutation.status);

  const context = await getAdminApiContext(request, { scope: "admin-push-test", limit: 10 });
  if (!context.ok) return context.response;
  const { profile } = context;

  const result = await sendAdminWebPush(
    {
      title: "FZAC Materiales · Notificaciones activas",
      body: "Este dispositivo ya puede recibir avisos de pagos aprobados.",
      url: getAdminConsolePath(),
      tag: "fzac-push-test"
    },
    { userIds: [profile.id] }
  );

  if (result.disabled) return jsonError("Las notificaciones push no están configuradas en el servidor.", 503);
  if (!result.sent) return jsonError("No encontramos un dispositivo activo para enviar la prueba.", 409);

  return Response.json({ ok: true, sent: result.sent, failed: result.failed });
}
