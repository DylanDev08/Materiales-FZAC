import { z } from "zod";
import { getAdminApiContext } from "@/lib/auth/admin-api";
import { jsonError } from "@/lib/utils/api";
import { readLimitedJson } from "@/lib/utils/request-security";

const schema=z.object({
  categoryId:z.string().uuid(),
  targetMarginPct:z.coerce.number().min(0).max(100),
  autoUpdateThresholdPct:z.coerce.number().min(1).max(100),
  alertOverMarketPct:z.coerce.number().min(1).max(200),
  active:z.boolean().default(true)
});

export async function GET(request:Request){
  const ctx=await getAdminApiContext(request,{scope:"admin-category-pricing-rules-read",limit:60});
  if(!ctx.ok) return ctx.response;
  const {data,error}=await ctx.admin
    .from("category_pricing_rules")
    .select("category_id,target_margin_pct,auto_update_threshold_pct,alert_over_market_pct,active,updated_at,category:categories(name,slug)")
    .order("updated_at",{ascending:false});
  if(error) return jsonError("No pudimos cargar las reglas por categoría.",500);
  return Response.json({rows:data ?? []},{headers:{"Cache-Control":"private, no-store"}});
}

export async function PUT(request:Request){
  const ctx=await getAdminApiContext(request,{scope:"admin-category-pricing-rules-write",limit:30});
  if(!ctx.ok) return ctx.response;
  const body=await readLimitedJson(request,8*1024);
  if(!body.ok) return jsonError(body.message,body.status);
  const parsed=schema.safeParse(body.data);
  if(!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Regla inválida.",422);

  const {data:category}=await ctx.admin.from("categories").select("id,name").eq("id",parsed.data.categoryId).maybeSingle();
  if(!category) return jsonError("Categoría inexistente.",404);

  const {error}=await ctx.admin.from("category_pricing_rules").upsert({
    category_id:parsed.data.categoryId,
    target_margin_pct:parsed.data.targetMarginPct,
    auto_update_threshold_pct:parsed.data.autoUpdateThresholdPct,
    alert_over_market_pct:parsed.data.alertOverMarketPct,
    active:parsed.data.active,
    updated_by:ctx.profile.id,
    updated_at:new Date().toISOString()
  },{onConflict:"category_id"});
  if(error) return jsonError("No pudimos guardar la regla por categoría.",409);

  await ctx.admin.from("admin_audit_logs").insert({
    actor_id:ctx.profile.id,actor_email:ctx.profile.email,actor_role:ctx.profile.role,
    action:"CATEGORY_PRICING_RULE_UPDATED",entity:"categories",entity_id:category.id,
    message:`Regla de precio actualizada: ${category.name}`,
    metadata:{
      target_margin_pct:parsed.data.targetMarginPct,
      auto_update_threshold_pct:parsed.data.autoUpdateThresholdPct,
      alert_over_market_pct:parsed.data.alertOverMarketPct,
      active:parsed.data.active
    }
  });

  return Response.json({ok:true,message:`Regla de ${category.name} actualizada.`});
}
