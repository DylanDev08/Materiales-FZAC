import { z } from "zod";
import { jsonError } from "@/lib/utils/api";
import { rateLimitRequest, retryAfterHeaders } from "@/lib/utils/rate-limit";
import { getWhatsAppConfig } from "@/lib/whatsapp/config";
import { parseWhatsAppPayload } from "@/lib/whatsapp/message-parser";
import { verifyMetaSignature, verifyWebhookToken } from "@/lib/whatsapp/security";
import { processWhatsAppMessage } from "@/lib/whatsapp/webhook";

export const runtime = "nodejs";

const verificationSchema = z.object({
  "hub.mode": z.literal("subscribe"),
  "hub.verify_token": z.string().min(1).max(500),
  "hub.challenge": z.string().min(1).max(500)
});

export async function GET(request: Request) {
  const limit = rateLimitRequest(request, { scope: "whatsapp-webhook-verify", limit: 30, windowMs: 60_000 });
  if (!limit.ok) return jsonError("Demasiados intentos de verificación.", 429, retryAfterHeaders(limit));
  const config = getWhatsAppConfig();
  if (!config.canVerifyWebhook) return jsonError("Webhook no configurado.", 503);
  const query = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = verificationSchema.safeParse(query);
  if (!parsed.success || !verifyWebhookToken(parsed.data["hub.verify_token"], config.verifyToken)) {
    return jsonError("Verificación rechazada.", 401);
  }
  return new Response(parsed.data["hub.challenge"], {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }
  });
}

export async function POST(request: Request) {
  const config = getWhatsAppConfig();
  const limit = rateLimitRequest(request, { scope: "whatsapp-webhook", limit: 120, windowMs: 60_000 });
  if (!limit.ok) return jsonError("Demasiados eventos.", 429, retryAfterHeaders(limit));

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > 256 * 1024) return jsonError("Evento demasiado grande.", 413);
  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > 256 * 1024) return jsonError("Evento demasiado grande.", 413);
  if (!config.canVerifySignature || !verifyMetaSignature(rawBody, request.headers.get("x-hub-signature-256"), config.appSecret)) {
    return jsonError("Firma de webhook inválida.", 401);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return jsonError("Evento inválido.", 400);
  }
  const messages = parseWhatsAppPayload(payload);
  if (!config.enabled) return Response.json({ received: true, mode: "disabled", messages: messages.length });
  const results = [];
  for (const message of messages) results.push(await processWhatsAppMessage(message));
  return Response.json({
    received: true,
    mode: config.dryRun ? "dry-run" : "active",
    processed: results.filter((result) => result === "PROCESSED").length,
    duplicates: results.filter((result) => result === "DUPLICATE").length
  });
}
