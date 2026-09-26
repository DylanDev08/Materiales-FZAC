import "server-only";

import { getUserProfile } from "@/lib/auth/get-user";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type OwnedOrderPaymentState = {
  orderId: string;
  orderStatus: string;
  paymentStatus: string | null;
};

export async function getOwnedOrderPaymentState(orderId?: string): Promise<OwnedOrderPaymentState | null> {
  if (!orderId || !UUID_PATTERN.test(orderId)) return null;

  const profile = await getUserProfile();
  const admin = getSupabaseAdminClient();
  if (!profile || !admin) return null;

  let query = admin.from("orders").select("id,user_id,status").eq("id", orderId);
  if (profile.role !== "ADMIN") query = query.eq("user_id", profile.id);

  const { data: order, error } = await query.maybeSingle();
  if (error || !order) return null;

  const { data: payment } = await admin
    .from("payments")
    .select("status")
    .eq("order_id", order.id)
    .maybeSingle();

  return {
    orderId: String(order.id),
    orderStatus: String(order.status ?? ""),
    paymentStatus: payment?.status ? String(payment.status) : null
  };
}
