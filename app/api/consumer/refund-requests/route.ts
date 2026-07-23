import { randomBytes } from "node:crypto";
import { z, ZodError } from "zod";
import { getCurrentUser } from "@/lib/auth/get-user";
import { consumerRefundReceivedEmailTemplate } from "@/lib/email/templates";
import { isResendConfigured, sendTransactionalEmail } from "@/lib/email/resend";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/utils/api";
import { getAdminConsolePath, getSiteUrl } from "@/lib/utils/env";
import { getRequestKey, rateLimit, retryAfterHeaders } from "@/lib/utils/rate-limit";
import {
  assertSafeText,
  isSafeUserNote,
  isValidArgentinePhone,
  normalizeUserNote
} from "@/lib/validations/security";

const requestSchema = z.object({
  idempotencyKey: z.string().uuid("No pudimos validar este intento. Recargá la página e intentá nuevamente."),
  company: z.string().max(0).optional().default(""),
  fullName: z
    .string()
    .trim()
    .min(2, "Ingresá tu nombre y apellido.")
    .max(90, "El nombre es demasiado largo.")
    .refine((value) => /^[\p{L}\p{M}\s'.-]+$/u.test(value), "Ingresá un nombre válido."),
  email: z.string().trim().toLowerCase().email("Ingresá un email válido.").max(120, "El email es demasiado largo."),
  phone: z.string().trim().refine(isValidArgentinePhone, "Ingresá un teléfono argentino válido."),
  orderNumber: z
    .string()
    .trim()
    .max(60, "El número de pedido es demasiado largo.")
    .refine((value) => !value || /^[a-zA-Z0-9-]+$/.test(value), "Ingresá un número de pedido válido.")
    .optional()
    .or(z.literal("")),
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

async function findLinkedOrder(input: {
  admin: NonNullable<ReturnType<typeof getSupabaseAdminClient>>;
  orderNumber: string | null;
  email: string;
  userId: string | null;
}) {
  if (!input.orderNumber) return null;

  let orderId = "";
  if (z.string().uuid().safeParse(input.orderNumber).success) {
    orderId = input.orderNumber;
  } else {
    const { data: ticket } = await input.admin
      .from("purchase_tickets")
      .select("order_id")
      .ilike("number", input.orderNumber)
      .maybeSingle();
    orderId = String(ticket?.order_id ?? "");
  }

  if (!orderId) return null;
  const { data: order } = await input.admin
    .from("orders")
    .select("id,user_id,customer_email")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return null;

  const matchesUser = Boolean(input.userId && order.user_id === input.userId);
  const matchesEmail = String(order.customer_email ?? "").trim().toLowerCase() === input.email;
  return matchesUser || matchesEmail ? String(order.id) : null;
}

async function existingRequest(
  admin: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  idempotencyKey: string
) {
  const { data } = await admin
    .from("consumer_refund_requests")
    .select("request_number,email")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  return data;
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

    const replay = await existingRequest(admin, payload.idempotencyKey);
    if (replay) {
      if (String(replay.email).toLowerCase() !== payload.email) {
        return jsonError("Este intento ya fue utilizado. Recargá la página para iniciar uno nuevo.", 409);
      }
      return Response.json({
        ok: true,
        replayed: true,
        request_number: replay.request_number,
        message: "La solicitud ya estaba registrada. Conservá el número de trámite para el seguimiento."
      });
    }

    const requestNumber = createRequestNumber();
    const currentUser = await getCurrentUser();
    const userId = currentUser?.id ?? null;
    if (currentUser?.email && currentUser.email.trim().toLowerCase() !== payload.email) {
      return jsonError("Usá el mismo email de tu cuenta para vincular correctamente la solicitud.", 422);
    }
    const orderNumber = payload.orderNumber?.trim() || null;
    const orderId = await findLinkedOrder({ admin, orderNumber, email: payload.email, userId });

    const { data, error } = await admin
      .from("consumer_refund_requests")
      .insert({
        request_number: requestNumber,
        idempotency_key: payload.idempotencyKey,
        user_id: userId,
        order_id: orderId,
        order_number: orderNumber,
        full_name: payload.fullName,
        email: payload.email,
        phone: payload.phone,
        reason: payload.reason,
        details: payload.details,
        preferred_contact: payload.preferredContact,
        metadata: {
          reason_label: reasonLabels[payload.reason],
          source: "boton_arrepentimiento_web",
          order_linked: Boolean(orderId),
          receipt_email: "pending"
        }
      })
      .select("id,request_number")
      .single();

    if (error || !data) {
      if (error?.code === "23505") {
        const existing = await existingRequest(admin, payload.idempotencyKey);
        if (existing && String(existing.email).toLowerCase() === payload.email) {
          return Response.json({
            ok: true,
            replayed: true,
            request_number: existing.request_number,
            message: "La solicitud ya estaba registrada. Conservá el número de trámite para el seguimiento."
          });
        }
      }
      return jsonError("No pudimos registrar la solicitud.", 400);
    }

    try {
      await admin.from("notifications").insert({
        target_role: "ADMIN",
        type: "CONSUMER_REFUND_REQUEST",
        title: "Solicitud de arrepentimiento recibida",
        message: `${payload.fullName} inició el trámite ${data.request_number}${orderNumber ? ` para el pedido ${orderNumber}` : ""}.`,
        link_to: `${getAdminConsolePath()}/arrepentimientos?request=${encodeURIComponent(data.request_number)}`
      });
    } catch {
      // El número de trámite sigue siendo la constancia primaria si falla un aviso interno.
    }

    let receiptSent = false;
    if (isResendConfigured()) {
      try {
        const actionUrl = new URL(userId ? "/cuenta/solicitudes" : "/arrepentimiento", getSiteUrl()).toString();
        const template = consumerRefundReceivedEmailTemplate({
          name: payload.fullName,
          requestNumber: data.request_number,
          orderNumber,
          actionUrl
        });
        await sendTransactionalEmail({ to: { email: payload.email, name: payload.fullName }, ...template });
        receiptSent = true;
      } catch {
        receiptSent = false;
      }
    }

    try {
      await admin
        .from("consumer_refund_requests")
        .update({
          metadata: {
            reason_label: reasonLabels[payload.reason],
            source: "boton_arrepentimiento_web",
            order_linked: Boolean(orderId),
            receipt_email: receiptSent ? "sent" : "not_sent"
          },
          updated_at: new Date().toISOString()
        })
        .eq("id", data.id);
    } catch {
      // La solicitud ya fue registrada; esta marca operativa no debe invalidarla.
    }

    return Response.json(
      {
        ok: true,
        request_number: data.request_number,
        receipt_sent: receiptSent,
        message: receiptSent
          ? "Solicitud registrada correctamente. Te enviamos una constancia por email."
          : "Solicitud registrada correctamente. Guardá el número de trámite para el seguimiento."
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ZodError) return jsonError(error.issues[0]?.message ?? "Revisá los datos ingresados.", 422);
    if (error instanceof Error && error.message.includes("caracteres no permitidos")) return jsonError(error.message, 422);
    return jsonError("No pudimos registrar la solicitud. Intentá nuevamente en unos minutos.", 500);
  }
}
