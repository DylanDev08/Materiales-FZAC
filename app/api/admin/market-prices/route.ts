import { ZodError } from "zod";
import { getApiAdmin } from "@/lib/auth/api-guards";
import { getMarketPriceAdminData, saveMarketObservation } from "@/lib/market-pricing/service";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/utils/api";
import { getRequestKey, rateLimit, retryAfterHeaders } from "@/lib/utils/rate-limit";
import { validateJsonMutationRequest } from "@/lib/utils/request-security";
import { marketPricePayloadSchema } from "@/lib/validations/market-pricing";

async function guard(request: Request) {
  const limit = rateLimit(getRequestKey(request, "admin-market-prices"), 60, 60_000);
  if (!limit.ok) return { error: jsonError("Demasiadas solicitudes.", 429, retryAfterHeaders(limit)) };
  const profile = await getApiAdmin();
  if (!profile) return { error: jsonError("No autorizado.", 401) };
  const admin = getSupabaseAdminClient();
  if (!admin) return { error: jsonError("Backend administrativo no disponible.", 503) };
  return { profile, admin };
}

export async function GET(request: Request) {
  const access = await guard(request);
  if ("error" in access) return access.error;
  return Response.json(await getMarketPriceAdminData(), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const mutation = validateJsonMutationRequest(request);
  if (!mutation.ok) return jsonError(mutation.message, mutation.status);
  const access = await guard(request);
  if ("error" in access) return access.error;
  try {
    const payload = marketPricePayloadSchema.parse(await request.json());
    if (payload.action === "SOURCE") {
      const source = {
        slug: payload.slug,
        name: payload.name,
        source_type: payload.sourceType,
        base_url: payload.baseUrl ?? null,
        feed_url: payload.feedUrl ?? null,
        active: payload.active,
        trusted: payload.trusted,
        notes: payload.notes ?? null,
        updated_by: access.profile.id
      };
      const query = payload.id
        ? access.admin.from("market_price_sources").update(source).eq("id", payload.id)
        : access.admin.from("market_price_sources").insert({ ...source, created_by: access.profile.id });
      const { data, error } = await query.select("*").single();
      if (error) return jsonError("No pudimos guardar la fuente. Revisá nombre, URL e identificador.", 400);
      await access.admin.from("admin_audit_logs").insert({
        actor_id: access.profile.id,
        actor_email: access.profile.email,
        action: payload.id ? "MARKET_PRICE_SOURCE_UPDATED" : "MARKET_PRICE_SOURCE_CREATED",
        entity: "market_price_sources",
        entity_id: data.id,
        message: `Fuente de precios guardada: ${data.name}`
      });
      return Response.json({ source: data }, { status: payload.id ? 200 : 201 });
    }

    const observation = await saveMarketObservation({
      productId: payload.productId,
      sourceId: payload.sourceId,
      externalKey: payload.externalKey,
      externalName: payload.externalName,
      sourceUrl: payload.sourceUrl,
      observedPrice: payload.observedPrice,
      saleUnit: payload.saleUnit,
      equivalentQuantity: payload.equivalentQuantity,
      observedAt: payload.observedAt,
      expiresAt: payload.expiresAt,
      createdBy: access.profile.id
    });
    await access.admin.from("admin_audit_logs").insert({
      actor_id: access.profile.id,
      actor_email: access.profile.email,
      action: "MARKET_PRICE_OBSERVATION_CREATED",
      entity: "market_price_observations",
      entity_id: observation.id,
      message: "Referencia de mercado registrada"
    });
    return Response.json({ observation }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) return jsonError(error.issues[0]?.message ?? "Datos inválidos.", 422);
    return jsonError(error instanceof Error ? error.message : "No pudimos guardar la referencia.", 400);
  }
}
