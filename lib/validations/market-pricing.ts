import { z } from "zod";
import { isSafePlainText } from "@/lib/validations/security";

const safeText = (minimum: number, maximum: number) =>
  z.string().trim().min(minimum).max(maximum).refine(isSafePlainText, "El texto contiene contenido no permitido.");

const httpsUrl = z.string().url().max(500).refine((value) => new URL(value).protocol === "https:", "Usá una URL HTTPS.");

export const marketPriceSourceSchema = z.object({
  action: z.literal("SOURCE"),
  id: z.string().uuid().optional(),
  slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: safeText(2, 120),
  sourceType: z.enum(["MANUAL", "API_JSON"]),
  baseUrl: httpsUrl.nullable().optional(),
  feedUrl: httpsUrl.nullable().optional(),
  active: z.boolean().default(true),
  trusted: z.boolean().default(false),
  notes: safeText(2, 500).nullable().optional()
}).refine((value) => value.sourceType !== "API_JSON" || Boolean(value.feedUrl), {
  message: "Una fuente automática necesita una URL de feed HTTPS.",
  path: ["feedUrl"]
});

export const marketPriceObservationSchema = z.object({
  action: z.literal("OBSERVATION"),
  productId: z.string().uuid(),
  sourceId: z.string().uuid(),
  externalKey: safeText(1, 160),
  externalName: safeText(2, 240),
  sourceUrl: httpsUrl.nullable().optional(),
  observedPrice: z.coerce.number().positive().max(1_000_000_000),
  saleUnit: safeText(1, 40),
  equivalentQuantity: z.coerce.number().positive().max(100_000).default(1),
  observedAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional()
}).refine((value) => !value.expiresAt || !value.observedAt || new Date(value.expiresAt) > new Date(value.observedAt), {
  message: "La vigencia debe terminar después de la observación.",
  path: ["expiresAt"]
});

export const marketPricePayloadSchema = z.union([
  marketPriceSourceSchema,
  marketPriceObservationSchema
]);

export const marketFeedSchema = z.object({
  items: z.array(z.object({
    external_key: z.string().trim().min(1).max(160),
    fzac_sku: z.string().trim().min(1).max(80),
    name: z.string().trim().min(2).max(240),
    price: z.coerce.number().positive().max(1_000_000_000),
    currency: z.literal("ARS").default("ARS"),
    sale_unit: z.string().trim().min(1).max(40),
    equivalent_quantity: z.coerce.number().positive().max(100_000).default(1),
    url: httpsUrl.optional(),
    observed_at: z.string().datetime().optional()
  })).max(500)
});
