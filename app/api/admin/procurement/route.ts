import { ZodError } from "zod";
import { getApiAdmin } from "@/lib/auth/api-guards";
import { getProcurementData } from "@/lib/procurement/service";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/utils/api";
import { getRequestKey, rateLimit, retryAfterHeaders } from "@/lib/utils/rate-limit";
import { validateJsonMutationRequest } from "@/lib/utils/request-security";
import { procurementPayloadSchema } from "@/lib/validations/procurement";

async function guard(request: Request, mutation = false) {
  if (mutation) {
    const trusted = validateJsonMutationRequest(request, 64 * 1024);
    if (!trusted.ok) return { response: jsonError(trusted.message, trusted.status) };
  }
  const profile = await getApiAdmin();
  if (!profile) return { response: jsonError("No autorizado.", 401) };
  const limit = rateLimit(`${getRequestKey(request, "admin-procurement")}:${profile.id}`, mutation ? 30 : 60, 60_000);
  if (!limit.ok) return { response: jsonError("Demasiadas operaciones. Probá nuevamente en un minuto.", 429, retryAfterHeaders(limit)) };
  const admin = getSupabaseAdminClient();
  if (!admin) return { response: jsonError("Backend administrativo no disponible.", 503) };
  return { profile, admin };
}
export async function GET(request: Request) {
  const current = await guard(request);
  if ("response" in current) return current.response;
  return Response.json(await getProcurementData(), { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const current = await guard(request, true);
  if ("response" in current) return current.response;
  try {
    const payload = procurementPayloadSchema.parse(await request.json());

    if (payload.action === "SAVE_SUPPLIER") {
      const values = {
        code: payload.code,
        name: payload.name,
        contact_name: payload.contactName,
        email: payload.email,
        phone: payload.phone,
        tax_id: payload.taxId,
        payment_terms: payload.paymentTerms,
        lead_time_days: payload.leadTimeDays,
        notes: payload.notes,
        active: payload.active,
        updated_by: current.profile.id
      };
      const query = payload.id
        ? current.admin.from("suppliers").update(values).eq("id", payload.id)
        : current.admin.from("suppliers").insert({ ...values, created_by: current.profile.id });
      const { data, error } = await query.select("id,name").single();
      if (error || !data) return jsonError("No pudimos guardar el proveedor. Revisá código, email y CUIT.", 409);
      await current.admin.from("admin_audit_logs").insert({
        actor_id: current.profile.id,
        actor_email: current.profile.email,
        actor_role: current.profile.role,
        action: payload.id ? "SUPPLIER_UPDATED" : "SUPPLIER_CREATED",
        entity: "suppliers",
        entity_id: data.id,
        message: `Proveedor guardado: ${data.name}`
      });
      return Response.json({ ok: true, id: data.id }, { status: payload.id ? 200 : 201 });
    }

    if (payload.action === "CREATE_ORDER") {
      const { data, error } = await current.admin.rpc("create_purchase_order", {
        p_supplier_id: payload.supplierId,
        p_request_key: payload.requestKey,
        p_expected_at: payload.expectedAt,
        p_notes: payload.notes ?? "",
        p_items: payload.items,
        p_actor_id: current.profile.id
      });
      const created = Array.isArray(data) ? data[0] : data;
      if (error || !created) return jsonError("No pudimos crear la orden. Revisá proveedor, productos y costos.", 409);
      return Response.json({ ok: true, orderId: created.order_id, orderNumber: created.order_number }, { status: 201 });
    }

    return jsonError("Acción no permitida para este método.", 405);
  } catch (error) {
    if (error instanceof ZodError) return jsonError(error.issues[0]?.message ?? "Revisá los datos.", 422);
    if (error instanceof SyntaxError) return jsonError("El contenido enviado no es válido.", 400);
    return jsonError("No pudimos guardar la operación.", 500);
  }
}

export async function PATCH(request: Request) {
  const current = await guard(request, true);
  if ("response" in current) return current.response;
  try {
    const payload = procurementPayloadSchema.parse(await request.json());
    const now = new Date().toISOString();

    if (payload.action === "ORDER_PURCHASE") {
      const { data, error } = await current.admin.from("purchase_orders")
        .update({ status: "ORDERED", ordered_by: current.profile.id, ordered_at: now })
        .eq("id", payload.orderId).eq("status", "DRAFT").select("id,order_number").maybeSingle();
      if (error || !data) return jsonError("La orden no existe o ya fue enviada.", 409);
      await current.admin.from("admin_audit_logs").insert({ actor_id: current.profile.id, actor_email: current.profile.email, actor_role: current.profile.role, action: "PURCHASE_ORDER_SENT", entity: "purchase_orders", entity_id: data.id, message: `Orden enviada al proveedor: ${data.order_number}` });
      return Response.json({ ok: true, status: "ORDERED" });
    }

    if (payload.action === "CANCEL_PURCHASE") {
      const { data, error } = await current.admin.from("purchase_orders")
        .update({ status: "CANCELLED", cancelled_by: current.profile.id, cancelled_at: now, cancellation_reason: payload.reason })
        .eq("id", payload.orderId).in("status", ["DRAFT", "ORDERED"]).select("id,order_number").maybeSingle();
      if (error || !data) return jsonError("La orden no puede cancelarse en su estado actual.", 409);
      await current.admin.from("admin_audit_logs").insert({ actor_id: current.profile.id, actor_email: current.profile.email, actor_role: current.profile.role, action: "PURCHASE_ORDER_CANCELLED", entity: "purchase_orders", entity_id: data.id, message: `Orden cancelada: ${data.order_number}`, metadata: { reason: payload.reason } });
      return Response.json({ ok: true, status: "CANCELLED" });
    }

    if (payload.action === "RECEIVE_PURCHASE") {
      const { data, error } = await current.admin.rpc("receive_purchase_order", { p_order_id: payload.orderId, p_items: payload.items, p_actor_id: current.profile.id });
      const receipt = Array.isArray(data) ? data[0] : data;
      if (error || !receipt) return jsonError("No pudimos recibir la mercadería. Revisá las cantidades pendientes.", 409);
      return Response.json({ ok: true, status: receipt.status });
    }

    return jsonError("Acción no permitida para este método.", 405);
  } catch (error) {
    if (error instanceof ZodError) return jsonError(error.issues[0]?.message ?? "Revisá los datos.", 422);
    if (error instanceof SyntaxError) return jsonError("El contenido enviado no es válido.", 400);
    return jsonError("No pudimos actualizar la orden.", 500);
  }
}
