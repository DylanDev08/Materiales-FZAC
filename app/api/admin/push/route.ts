import { z, ZodError } from "zod";
import { getAdminApiContext } from "@/lib/auth/admin-api";
import { getAdminPushPublicConfig } from "@/lib/notifications/web-push";
import { jsonError } from "@/lib/utils/api";
import { validateJsonMutationRequest } from "@/lib/utils/request-security";

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(4096).refine((value) => value.startsWith("https://"), "Endpoint de push inválido."),
  keys: z.object({
    p256dh: z.string().min(20).max(512),
    auth: z.string().min(10).max(256)
  }),
  deviceLabel: z.string().trim().max(120).optional()
});

const deleteSchema = z.object({
  endpoint: z.string().url().max(4096)
});

export async function GET(request: Request) {
  const context = await getAdminApiContext(request, { scope: "admin-push-read", limit: 60 });
  if (!context.ok) return context.response;
  const { admin, profile } = context;
  const config = await getAdminPushPublicConfig();

  const { data, error } = await admin
    .from("admin_push_subscriptions")
    .select("id,device_label,active,last_seen_at")
    .eq("user_id", profile.id)
    .eq("active", true)
    .order("last_seen_at", { ascending: false })
    .limit(20);

  if (error) return jsonError("No pudimos leer los dispositivos registrados.", 400);

  return Response.json({
    configured: config.configured,
    publicKey: config.publicKey,
    devices: data ?? []
  });
}

export async function POST(request: Request) {
  const mutation = validateJsonMutationRequest(request, 12 * 1024);
  if (!mutation.ok) return jsonError(mutation.message, mutation.status);

  const context = await getAdminApiContext(request, { scope: "admin-push-subscribe", limit: 20 });
  if (!context.ok) return context.response;
  const { admin, profile } = context;
  const config = getAdminPushPublicConfig();
  if (!config.configured) return jsonError("Las notificaciones push todavía no están configuradas en el servidor.", 503);

  try {
    const payload = subscriptionSchema.parse(await request.json());
    const now = new Date().toISOString();
    const { error } = await admin
      .from("admin_push_subscriptions")
      .upsert(
        {
          user_id: profile.id,
          endpoint: payload.endpoint,
          p256dh: payload.keys.p256dh,
          auth: payload.keys.auth,
          device_label: payload.deviceLabel || "Dispositivo administrador",
          user_agent: request.headers.get("user-agent")?.slice(0, 500) || null,
          active: true,
          last_seen_at: now,
          updated_at: now
        },
        { onConflict: "endpoint" }
      );

    if (error) return jsonError("No pudimos registrar este dispositivo.", 400);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError) return jsonError(error.issues[0]?.message ?? "Suscripción push inválida.", 422);
    return jsonError("No pudimos registrar este dispositivo.", 400);
  }
}

export async function DELETE(request: Request) {
  const mutation = validateJsonMutationRequest(request, 8 * 1024);
  if (!mutation.ok) return jsonError(mutation.message, mutation.status);

  const context = await getAdminApiContext(request, { scope: "admin-push-unsubscribe", limit: 20 });
  if (!context.ok) return context.response;
  const { admin, profile } = context;

  try {
    const payload = deleteSchema.parse(await request.json());
    const { error } = await admin
      .from("admin_push_subscriptions")
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq("user_id", profile.id)
      .eq("endpoint", payload.endpoint);

    if (error) return jsonError("No pudimos desactivar este dispositivo.", 400);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError) return jsonError(error.issues[0]?.message ?? "Dispositivo inválido.", 422);
    return jsonError("No pudimos desactivar este dispositivo.", 400);
  }
}
