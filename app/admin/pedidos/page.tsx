export const dynamic = "force-dynamic";
export const revalidate = 0;

import { AdminPaymentConfirmation } from "@/components/admin/admin-payment-confirmation";
import { AdminOrdersView } from "@/components/admin/admin-orders-view";
import { AdminShell } from "@/components/admin/admin-shell";
import { getAdminAssignableUsers, getAdminOrderTableRows } from "@/lib/db/admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export default async function Page() {
  await requireAdmin();
  const [baseRows, assignees] = await Promise.all([getAdminOrderTableRows(), getAdminAssignableUsers()]);
  const admin = getSupabaseAdminClient();
  const orderIds = baseRows.map((row) => String(row.Id || "")).filter(Boolean);

  let rows = baseRows;
  if (admin && orderIds.length) {
    const [{ data: proofs }, { data: orders }] = await Promise.all([
      admin
        .from("whatsapp_payment_proofs")
        .select("order_id,media_id,mime_type,filename,status,created_at")
        .in("order_id", orderIds)
        .order("created_at", { ascending: false }),
      admin
        .from("orders")
        .select("id,address_snapshot")
        .in("id", orderIds)
    ]);

    rows = baseRows.map((row) => {
      const orderId = String(row.Id || "");
      const proof = (proofs ?? []).find((item) => item.order_id === orderId);
      const order = (orders ?? []).find((item) => item.id === orderId);
      const address = order?.address_snapshot && typeof order.address_snapshot === "object"
        ? order.address_snapshot as Record<string, unknown>
        : null;
      const location = address?.whatsapp_location && typeof address.whatsapp_location === "object"
        ? address.whatsapp_location as Record<string, unknown>
        : null;

      return {
        ...row,
        __proofMediaId: proof?.media_id ? String(proof.media_id) : "",
        __proofStatus: proof?.status ? String(proof.status) : "",
        __proofFilename: proof?.filename ? String(proof.filename) : "",
        __whatsappLatitude: location?.latitude == null ? "" : String(location.latitude),
        __whatsappLongitude: location?.longitude == null ? "" : String(location.longitude),
        __whatsappLocationAddress: location?.address ? String(location.address) : ""
      };
    });
  }

  return (
    <AdminShell title="Pedidos">
      <AdminPaymentConfirmation rows={rows} />
      <AdminOrdersView rows={rows} assignees={assignees} />
    </AdminShell>
  );
}
