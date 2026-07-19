import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { PaymentProvider, PaymentStatus } from "@/types/domain";

type ConfirmationInput = {
  orderId: string;
  provider: PaymentProvider;
  providerPaymentId?: string | null;
  raw?: Record<string, unknown> | null;
  status?: PaymentStatus;
};

type RefundConfirmationInput = {
  paymentId: string;
  providerRefundId?: string | null;
  raw?: Record<string, unknown> | null;
  reason: string;
  actorId: string | null;
  actorEmail: string;
};

export class PaymentIntegrityRpcMissingError extends Error {
  code = "PAYMENT_INTEGRITY_RPC_MISSING";

  constructor() {
    super("La base de datos todavia no tiene aplicada la migracion de integridad de pagos.");
    this.name = "PaymentIntegrityRpcMissingError";
  }
}

function isMissingRpcError(error: { code?: string; message?: string }, functionName: string) {
  const message = String(error.message ?? "").toLowerCase();
  return error.code === "PGRST202" || message.includes(functionName.toLowerCase()) || message.includes("could not find the function");
}

export async function assertRefundIntegrityReady() {
  const admin = getSupabaseAdminClient();
  if (!admin) throw new Error("Supabase admin no esta configurado para registrar reembolsos.");

  const { error } = await admin.rpc("finalize_refunded_order", {
    p_payment_id: "00000000-0000-0000-0000-000000000000",
    p_provider_refund_id: null,
    p_raw: {},
    p_reason: "Verificacion de integridad",
    p_actor_id: null,
    p_actor_email: "system"
  });

  if (!error || String(error.message ?? "").includes("PAYMENT_NOT_FOUND")) return;
  if (isMissingRpcError(error, "finalize_refunded_order")) throw new PaymentIntegrityRpcMissingError();
  throw new Error("No pudimos validar la integridad de reembolsos en la base de datos.");
}

export async function confirmApprovedPayment(input: ConfirmationInput) {
  const admin = getSupabaseAdminClient();
  if (!admin) throw new Error("Supabase admin no esta configurado para confirmar pagos reales.");
  if (input.status && input.status !== "PAID") throw new Error("El pago no esta aprobado para finalizar la orden.");

  const { data, error } = await admin.rpc("finalize_paid_order", {
    p_order_id: input.orderId,
    p_provider_payment_id: input.providerPaymentId ?? null,
    p_raw: input.raw ?? {}
  });

  if (error) {
    if (isMissingRpcError(error, "finalize_paid_order")) throw new PaymentIntegrityRpcMissingError();
    throw new Error("No pudimos finalizar la orden aprobada de forma atomica.");
  }

  return { ok: true, source: "rpc", result: data };
}

export async function finalizeRefundedPayment(input: RefundConfirmationInput) {
  const admin = getSupabaseAdminClient();
  if (!admin) throw new Error("Supabase admin no esta configurado para registrar reembolsos.");

  const { data, error } = await admin.rpc("finalize_refunded_order", {
    p_payment_id: input.paymentId,
    p_provider_refund_id: input.providerRefundId ?? null,
    p_raw: input.raw ?? {},
    p_reason: input.reason,
    p_actor_id: input.actorId,
    p_actor_email: input.actorEmail
  });

  if (error) {
    if (isMissingRpcError(error, "finalize_refunded_order")) throw new PaymentIntegrityRpcMissingError();
    throw new Error("Mercado Pago confirmo el reembolso, pero no pudimos actualizar la orden de forma atomica.");
  }

  return { ok: true, source: "rpc", result: data };
}
