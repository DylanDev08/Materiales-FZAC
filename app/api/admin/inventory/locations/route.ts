import { z } from "zod";
import { getAdminApiContext } from "@/lib/auth/admin-api";
import { jsonError } from "@/lib/utils/api";
import { readLimitedJson } from "@/lib/utils/request-security";

const transferSchema=z.object({
  action:z.literal("TRANSFER"),
  productId:z.string().uuid(),
  fromLocationId:z.string().uuid(),
  toLocationId:z.string().uuid(),
  quantity:z.coerce.number().int().min(1).max(1000000)
});

export async function GET(request:Request){
  const ctx=await getAdminApiContext(request,{scope:"admin-inventory-locations-read",limit:90});
  if(!ctx.ok) return ctx.response;
  const [
    {data:locations,error:locationError},
    {data:rows,error:stockError},
    {data:supplierRows,error:supplierError}
  ]=await Promise.all([
    ctx.admin.from("inventory_locations").select("id,code,name,kind,active,sort_order").eq("active",true).order("sort_order"),
    ctx.admin.from("inventory_location_stock")
      .select("product_id,location_id,quantity,stock_minimum,updated_at,product:products(name,sku,unit,stock,active)")
      .order("updated_at",{ascending:false}).limit(5000),
    ctx.admin.from("product_supplier_sources")
      .select("product_id,supplier_stock,supplier_stock_checked_at,supplier:suppliers(name)")
      .not("supplier_id","is",null)
      .limit(5000)
  ]);
  if(locationError || stockError || supplierError) return jsonError("No pudimos cargar el stock por ubicación.",500);
  return Response.json({locations:locations ?? [],rows:rows ?? [],supplierRows:supplierRows ?? []},{headers:{"Cache-Control":"private, no-store"}});
}

export async function POST(request:Request){
  const ctx=await getAdminApiContext(request,{scope:"admin-inventory-location-transfer",limit:45});
  if(!ctx.ok) return ctx.response;
  const body=await readLimitedJson(request,8*1024);
  if(!body.ok) return jsonError(body.message,body.status);
  const parsed=transferSchema.safeParse(body.data);
  if(!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Transferencia inválida.",422);

  const {error}=await ctx.admin.rpc("transfer_inventory_location_stock",{
    p_product_id:parsed.data.productId,
    p_from_location:parsed.data.fromLocationId,
    p_to_location:parsed.data.toLocationId,
    p_quantity:parsed.data.quantity,
    p_actor_id:ctx.profile.id
  });
  if(error){
    const message=String(error.message ?? "");
    if(message.includes("INSUFFICIENT_LOCATION_STOCK")) return jsonError("No hay suficiente stock en la ubicación de origen.",409);
    return jsonError("No pudimos transferir el stock.",409);
  }

  await ctx.admin.from("admin_audit_logs").insert({
    actor_id:ctx.profile.id,actor_email:ctx.profile.email,actor_role:ctx.profile.role,
    action:"INVENTORY_LOCATION_TRANSFER",entity:"products",entity_id:parsed.data.productId,
    message:`Transferencia interna de ${parsed.data.quantity} unidades.`,
    metadata:{from_location_id:parsed.data.fromLocationId,to_location_id:parsed.data.toLocationId,quantity:parsed.data.quantity}
  });
  return Response.json({ok:true,message:"Transferencia registrada."});
}
