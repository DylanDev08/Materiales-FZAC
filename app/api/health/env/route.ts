import { getSupabaseConfig } from "@/lib/supabase/config";
import { getAdminApiContext } from "@/lib/auth/admin-api";
import {
  getMercadoPagoEnvironmentState,
  getPaymentProductionReadiness,
  isPaymentsEnabled
} from "@/lib/payments/config";
import { canQuoteShipping } from "@/lib/shipping/quote";
import { hasRealValue } from "@/lib/utils/env";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const context = await getAdminApiContext(request, { scope: "admin-environment-health", limit: 30 });
  if (!context.ok) return context.response;

  const supabase = getSupabaseConfig();
  const mercadoPago = getMercadoPagoEnvironmentState();
  const paymentProductionReadiness = getPaymentProductionReadiness();

  return Response.json(
    {
      supabasePublic: supabase.hasPublicConfig,
      supabaseServiceRole: supabase.hasServiceRole,
      databaseUrl: hasRealValue(process.env.DATABASE_URL),
      directUrl: hasRealValue(process.env.DIRECT_URL),
      paymentsEnabled: isPaymentsEnabled(),
      mercadoPagoPublic: hasRealValue(process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY),
      mercadoPagoServer: hasRealValue(process.env.MERCADOPAGO_ACCESS_TOKEN),
      mercadoPago,
      paymentProductionReadiness,
      resendConfigured: hasRealValue(process.env.RESEND_API_KEY) && hasRealValue(process.env.RESEND_FROM_EMAIL),
      resendFromEmail: hasRealValue(process.env.RESEND_FROM_EMAIL),
      shippingQuoteReady: canQuoteShipping(),
      adminEmails: hasRealValue(process.env.ADMIN_EMAILS),
      fiscalInvoicingConfigured:
        process.env.FISCAL_INVOICING_ENABLED?.toLowerCase() === "true" &&
        hasRealValue(process.env.FISCAL_INVOICING_PROVIDER)
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
