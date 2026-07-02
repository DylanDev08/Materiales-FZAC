import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/get-user";
import { getProducts } from "@/lib/db/catalog";
import { currency } from "@/lib/formatters/currency";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/utils/api";
import { getRequestKey, rateLimit } from "@/lib/utils/rate-limit";
import { hasSqlMeta, sanitizeSearchTerm } from "@/lib/validations/security";

const schema = z.object({
  message: z.string().trim().min(1).max(500),
  conversationId: z.string().uuid().nullable().optional(),
  visitorId: z.string().uuid().optional(),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(600), createdAt: z.string().optional() }))
    .max(12)
    .optional()
});

function advisoryReply(message: string) {
  if (message.includes("pago") || message.includes("tarjeta") || message.includes("mercado")) {
    return "Para pagar, FZAC usa proveedores externos como Mercado Pago. Eso significa que no guardamos numeros de tarjeta ni CVV. Cuando el pago queda aprobado, el backend confirma la orden, descuenta stock y genera el ticket. Si el pago queda pendiente, no se descuenta stock hasta confirmacion.";
  }

  if (message.includes("envio") || message.includes("envío") || message.includes("distancia") || message.includes("zona")) {
    return "El envio se valida con distancia desde Rosario. Si la direccion queda dentro de 30 km, el checkout habilita envio coordinado. Si supera esa zona, te conviene elegir retiro o escribir por WhatsApp para cotizar una entrega especial.";
  }

  if (message.includes("retiro")) {
    return "Para retiro, elegi Retiro coordinado en checkout. FZAC prepara el pedido y el admin actualiza el estado cuando este listo. Te recomiendo revisar bien cantidades, unidad de medida y telefono antes de pagar.";
  }

  if (message.includes("devolucion") || message.includes("cambio")) {
    return "Para cambios o devoluciones, conservá el ticket y contactá a FZAC indicando orden, producto y motivo. En materiales de obra suele revisarse estado del producto, embalaje y si fue pedido especial.";
  }

  if (message.includes("material") || message.includes("necesito") || message.includes("obra")) {
    return "Para recomendar materiales necesito saber superficie aproximada, si es interior/exterior, tipo de obra y terminacion buscada. Como regla: primero definí rubro, calculá margen por desperdicio y validá stock antes de cerrar el pago.";
  }

  return "Puedo ayudarte a elegir productos, revisar stock visible, explicar pagos, envios, retiro y estado de pedidos. Si me pasás qué querés construir o reparar, te oriento con una lista inicial y puntos a verificar antes de comprar.";
}

async function persistConversation(input: {
  conversationId?: string | null;
  visitorId?: string;
  userId?: string | null;
  message: string;
  reply: string;
}) {
  const admin = getSupabaseAdminClient();
  if (!admin) return input.conversationId ?? null;

  try {
    let conversationId = input.conversationId ?? null;

    if (!conversationId) {
      const { data, error } = await admin
        .from("chat_conversations")
        .insert({
          user_id: input.userId ?? null,
          visitor_id: input.visitorId ?? null,
          channel: "AI",
          status: "OPEN",
          subject: input.message.slice(0, 80),
          last_message_at: new Date().toISOString()
        })
        .select("id")
        .single();
      if (error || !data?.id) return null;
      conversationId = data.id;
    } else {
      await admin
        .from("chat_conversations")
        .update({ last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", conversationId);
    }

    await admin.from("chat_messages").insert([
      { conversation_id: conversationId, sender_id: input.userId ?? null, role: "USER", content: input.message },
      { conversation_id: conversationId, role: "ASSISTANT", content: input.reply }
    ]);

    return conversationId;
  } catch {
    return input.conversationId ?? null;
  }
}

export async function POST(request: Request) {
  const limit = rateLimit(getRequestKey(request, "assistant"), 30, 60_000);
  if (!limit.ok) return jsonError("Demasiadas consultas al asistente.", 429);

  const payload = schema.parse(await request.json());
  if (hasSqlMeta(payload.message)) return jsonError("La consulta contiene caracteres no permitidos.", 422);

  const message = sanitizeSearchTerm(payload.message, 500).toLowerCase();
  const user = await getCurrentUser();

  const words = message
    .split(/\s+/)
    .filter((word) => word.length > 3)
    .slice(0, 4);
  const query = words.join(" ");

  if (query) {
    const products = await getProducts({ search: query, limit: 3 });
    if (products.length) {
      const reply = `Encontré opciones reales del catálogo: ${products
        .map((product) => `${product.name} (${product.sku}) a ${currency(product.price)}, stock visible ${product.stock} ${product.unit}`)
        .join("; ")}. Te recomiendo entrar al detalle, revisar unidad de venta y agregar margen si es para obra.`;
      const conversationId = await persistConversation({
        conversationId: payload.conversationId,
        visitorId: payload.visitorId,
        userId: user?.id ?? null,
        message: payload.message,
        reply
      });
      return Response.json({ message: reply, conversationId });
    }
  }

  const reply = advisoryReply(message);
  const conversationId = await persistConversation({
    conversationId: payload.conversationId,
    visitorId: payload.visitorId,
    userId: user?.id ?? null,
    message: payload.message,
    reply
  });
  return Response.json({ message: reply, conversationId });
}
