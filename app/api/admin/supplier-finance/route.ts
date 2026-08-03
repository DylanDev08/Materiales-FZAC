import { ZodError } from "zod";
import { getApiAdmin } from "@/lib/auth/api-guards";
import { getSupplierFinanceData } from "@/lib/procurement/supplier-finance-service";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/utils/api";
import { getRequestKey, rateLimit, retryAfterHeaders } from "@/lib/utils/rate-limit";
import { validateJsonMutationRequest } from "@/lib/utils/request-security";
import { supplierFinancePayloadSchema } from "@/lib/validations/supplier-finance";

async function guard(request: Request, mutation = false) {
  if (mutation) {
    const trusted = validateJsonMutationRequest(request, 32 * 1024);
    if (!trusted.ok) return { response: jsonError(trusted.message, trusted.status) };
  }
  const profile = await getApiAdmin();
  if (!profile) return { response: jsonError("No autorizado.", 401) };
  const limit = rateLimit(`${getRequestKey(request, "admin-supplier-finance")}:${profile.id}`, mutation ? 24 : 60, 60_000);
  if (!limit.ok) return { response: jsonError("Demasiadas operaciones. Probá nuevamente en un minuto.", 429, retryAfterHeaders(limit)) };
  const admin = getSupabaseAdminClient();
  if (!admin) return { response: jsonError("Backend administrativo no disponible.", 503) };
  return { profile, admin };
}

export async function GET(request: Request) {
  const current = await guard(request);
  if ("response" in current) return current.response;
  return Response.json(await getSupplierFinanceData(), { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const current = await guard(request, true);
  if ("response" in current) return current.response;
  try {
    const payload = supplierFinancePayloadSchema.parse(await request.json());

    if (payload.action === "CREATE_INVOICE") {
      const { data, error } = await current.admin.rpc("register_supplier_invoice", {
        p_purchase_order_id: payload.purchaseOrderId,
        p_request_key: payload.requestKey,
        p_invoice_number: payload.invoiceNumber,
        p_amount: payload.amount,
        p_issued_at: payload.issuedAt,
        p_due_at: payload.dueAt,
        p_notes: payload.notes ?? "",
        p_actor_id: current.profile.id
      });
      const invoice = Array.isArray(data) ? data[0] : data;
      if (error || !invoice) return jsonError("No pudimos registrar la factura. Revisá la orden, el número y el importe disponible.", 409);
      return Response.json({ ok: true, invoiceId: invoice.invoice_id, status: invoice.invoice_status }, { status: 201 });
    }

    if (payload.action === "CREATE_PAYMENT") {
      const { data, error } = await current.admin.rpc("register_supplier_payment", {
        p_supplier_invoice_id: payload.invoiceId,
        p_request_key: payload.requestKey,
        p_amount: payload.amount,
        p_method: payload.method,
        p_reference: payload.reference ?? "",
        p_paid_at: payload.paidAt,
        p_notes: payload.notes ?? "",
        p_actor_id: current.profile.id
      });
      const payment = Array.isArray(data) ? data[0] : data;
      if (error || !payment) return jsonError("No pudimos registrar el pago. Revisá el saldo pendiente y los datos ingresados.", 409);
      return Response.json({ ok: true, paymentId: payment.payment_id, status: payment.invoice_status }, { status: 201 });
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
    const payload = supplierFinancePayloadSchema.parse(await request.json());

    if (payload.action === "VOID_PAYMENT") {
      const { data, error } = await current.admin.rpc("void_supplier_payment", {
        p_payment_id: payload.paymentId,
        p_reason: payload.reason,
        p_actor_id: current.profile.id
      });
      const payment = Array.isArray(data) ? data[0] : data;
      if (error || !payment) return jsonError("El pago no existe o ya fue anulado.", 409);
      return Response.json({ ok: true, status: payment.invoice_status });
    }

    if (payload.action === "VOID_INVOICE") {
      const { data, error } = await current.admin.rpc("void_supplier_invoice", {
        p_invoice_id: payload.invoiceId,
        p_reason: payload.reason,
        p_actor_id: current.profile.id
      });
      if (error || !data) return jsonError("Solo se pueden anular facturas pendientes que todavía no tengan pagos.", 409);
      return Response.json({ ok: true, invoiceId: data });
    }

    return jsonError("Acción no permitida para este método.", 405);
  } catch (error) {
    if (error instanceof ZodError) return jsonError(error.issues[0]?.message ?? "Revisá los datos.", 422);
    if (error instanceof SyntaxError) return jsonError("El contenido enviado no es válido.", 400);
    return jsonError("No pudimos actualizar la operación.", 500);
  }
}
