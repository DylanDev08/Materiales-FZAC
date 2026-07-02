import { getSupabaseConfig } from "@/lib/supabase/config";
import { hasRealValue } from "@/lib/utils/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = getSupabaseConfig();

  return Response.json(
    {
      supabasePublic: supabase.hasPublicConfig,
      supabaseServiceRole: supabase.hasServiceRole,
      databaseUrl: hasRealValue(process.env.DATABASE_URL),
      directUrl: hasRealValue(process.env.DIRECT_URL),
      googleMapsBrowser: hasRealValue(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY),
      googleMapsServer: hasRealValue(process.env.GOOGLE_MAPS_SERVER_API_KEY),
      mercadoPagoPublic: hasRealValue(process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY),
      mercadoPagoServer: hasRealValue(process.env.MERCADOPAGO_ACCESS_TOKEN),
      adminEmails: hasRealValue(process.env.ADMIN_EMAILS)
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
