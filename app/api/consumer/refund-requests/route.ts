import { randomBytes } from "node:crypto";
import { z, ZodError } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/utils/api";
import { getAdminConsolePath } from "@/lib/utils/env";
import { getRequestKey, rateLimit, retryAfterHeaders } from "@/lib/utils/rate-limit";
import {
  assertSafeText,
  isSafeUserNote,
  isValidArgentinePhone,
  normalizeUserNote
} from "@/lib/validations/security";

const requestSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Ingresá tu nombre y apellido.")
    .max(90, "El nombre es demasiado largo.")
    .refine((value) => /^[\p{L}\p{M}\s'.-]+$/u.test(value), "Ingresá un nombre válido."),
  email: z.string().trim().toLowerCase().email("Ingresá un email válido.").max(120, "El email es demasiado largo."),
  phone: z.string().trim().refine(isValidArgentinePhone, "Ingresá un teléfono argentino válido."),
  orderNumber: z.string().trim().max(60, "El número de pedido es demasiado largo.").optional().or(z.literal("")),
  reason: z.enum(["PURCHASE_REGRET", "WRONG_PRODUCT", "DAMAGED_PRODUCT", "NOT_DELIVERED", "OTHER"]),
  preferredContact: z.enum(["WHATSAPP", "EMAIL", "PHONE"]).default("WHATSAPP"),
  details: z
    .string()
    .transform((value) => normalizeUserNote(value, 900))
    .refine((value) => value.length >= 10, "Contanos brevemente qué necesitás revisar.")
    .refine(isSafeUserNote, "El comentario contiene caracteres no permitidos."),
  accepted: z.literal(true, {
    errorMap: () => ({ message: "Debés confirmar que querés iniciar la solicitud." })
  })
});

const reasonLabels: Record<z.infer<typeof requestSchema>["reason"], string> = {
  PURCHASE_REGRET: "Arrepentimiento de compra",
  WRONG_PRODUCT: "Producto equivocado",
  DAMAGED_PRODUCT: "Producto dañado",
  NOT_DELIVERED: "Pedido no entregado",
  OTHER: "Otro motivo"
};

function createRequestNumber() {
  const date = new Date();
  const stamp = [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0")
  ].join("");
  return `FZAC-${stamp}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

async function getCurrentUserId() {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function POST(request: Request) {
  const limit = rateLimit(getRequestKey(request, "consumer-refund-request"), 3, 15 * 60_000);
  if (!limit.ok) {
    return jsonError("Demasiadas solicitudes. Esperá unos minutos antes de volver a intentar.", 429, retryAfterHeaders(limit));
  }

  const admin = getSupabaseAdminClient();
  if (!admin) return jsonError("No pudimos registrar la solicitud en este momento.", 503);

  try {
    const payload = requestSchema.parse(await request.json());
    assertSafeText(payload.orderNumber, "número de pedido");

    const requestNumber = createRequestNumber();
    const userId = await getCurrentUserId();
    const orderNumber = payload.orderNumber?.trim() || null;

    const { data, error } = await admin
      .from("consumer_refund_requests")
      .insert({
        request_number: requestNumber,
        user_id: userId,
        order_number: orderNumber,
        full_name: payload.fullName,
        email: payload.email,
        phone: payload.phone,
        reason: payload.reason,
        details: payload.details,
        preferred_contact: payload.preferredContact,
        metadata: {
          reason_label: reasonLabels[payload.reason],
          source: "boton_arrepentimiento_web"
        }
      })
      .select("id,request_number")
      .single();

    if (error || !data) return jsonError("No pudimos registrar la solicitud.", 400);

    await admin.from("notifications").insert({
      target_role: "ADMIN",
      type: "CONSUMER_REFUND_REQUEST",
      title: "Solicitud de arrepentimiento recibida",
      message: `${payload.fullName} inició el trámite ${data.request_number}${orderNumber ? ` para el pedido ${orderNumber}` : ""}.`,
      link_to: `${getAdminConsolePath()}/logs?type=CONSUMER_REFUND_REQUEST`
    });

    return Response.json(
      {
        ok: true,
        request_number: data.request_number,
        message: "Solicitud registrada correctamente. FZAC revisará el caso y te contactará por el medio elegido."
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ZodError) return jsonError(error.issues[0]?.message ?? "Revisá los datos ingresados.", 422);
    if (error instanceof Error && error.message.includes("caracteres no permitidos")) return jsonError(error.message, 422);
    return jsonError("No pudimos registrar la solicitud. Intentá nuevamente en unos minutos.", 500);
  }
}
