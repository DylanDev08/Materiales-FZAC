import { z } from "zod";
import { getAdminApiContext } from "@/lib/auth/admin-api";
import { getWhatsAppConfig } from "@/lib/whatsapp/config";
import { jsonError } from "@/lib/utils/api";

const paramsSchema = z.object({
  mediaId: z.string().min(5).max(220).regex(/^[A-Za-z0-9_-]+$/, "Archivo invalido.")
});

export async function GET(request: Request, context: { params: Promise<{ mediaId: string }> }) {
  const access = await getAdminApiContext(request, { scope: "admin-whatsapp-media", limit: 30 });
  if (!access.ok) return access.response;

  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) return jsonError("Archivo invalido.", 422);

  const config = getWhatsAppConfig();
  if (!config.enabled || !config.canSend) return jsonError("WhatsApp no esta configurado.", 503);

  const metadataResponse = await fetch(
    `https://graph.facebook.com/${config.version}/${encodeURIComponent(params.data.mediaId)}`,
    {
      headers: { Authorization: `Bearer ${config.accessToken}` },
      cache: "no-store"
    }
  );
  if (!metadataResponse.ok) return jsonError("No pudimos recuperar el comprobante desde Meta.", 502);

  const metadata = await metadataResponse.json() as { url?: string; mime_type?: string; file_size?: number };
  if (!metadata.url) return jsonError("Meta no devolvio el archivo del comprobante.", 502);

  const fileResponse = await fetch(metadata.url, {
    headers: { Authorization: `Bearer ${config.accessToken}` },
    cache: "no-store"
  });
  if (!fileResponse.ok) return jsonError("No pudimos descargar el comprobante desde Meta.", 502);

  const bytes = await fileResponse.arrayBuffer();
  const contentType = fileResponse.headers.get("content-type") || metadata.mime_type || "application/octet-stream";
  return new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Disposition": "inline"
    }
  });
}
