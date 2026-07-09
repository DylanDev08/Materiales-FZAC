import { getSupabaseConfig } from "@/lib/supabase/config";
import { getApiAdmin } from "@/lib/auth/api-guards";
import { isPaymentsEnabled } from "@/lib/payments/config";
import { canQuoteShipping } from "@/lib/shipping/quote";
import { jsonError } from "@/lib/utils/api";
import { hasRealValue } from "@/lib/utils/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const profile = await getApiAdmin();
  if (!profile) return jsonError("No autorizado.", 401);

  const supabase = getSupabaseConfig();

  return Response.json(
    {
      supabasePublic: supabase.hasPublicConfig,
      supabaseServiceRole: supabase.hasServiceRole,
      databaseUrl: hasRealValue(process.env.DATABASE_URL),
      directUrl: hasRealValue(process.env.DIRECT_URL),
      paymentsEnabled: isPaymentsEnabled(),
      mercadoPagoPublic: hasRealValue(process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY),
      mercadoPagoServer: hasRealValue(process.env.MERCADOPAGO_ACCESS_TOKEN),
      shippingQuoteReady: canQuoteShipping(),
      adminEmails: hasRealValue(process.env.ADMIN_EMAILS)
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
