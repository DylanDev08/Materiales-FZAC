import { z } from "zod";
import { getAdminApiContext } from "@/lib/auth/admin-api";
import { sendWhatsAppText } from "@/lib/whatsapp/client";
import { jsonError } from "@/lib/utils/api";
import { validateJsonMutationRequest } from "@/lib/utils/request-security";
import type { TablesUpdate } from "@/types/supabase";

const schema=z.object({
  status:z.enum(["PREPARING","READY_FOR_PICKUP","READY_FOR_DELIVERY","OUT_FOR_DELIVERY","DELIVERED"]),
  assignedTo:z.string().uuid().nullable().optional(),
  carrierName:z.string().max(120).optional().default(""),
  carrierPhone:z.string().max(40).optional().default(""),
  estimatedWindow:z.string().max(120).optional().default(""),
  recipientName:z.string().max(120).optional().default(""),
  recipientPhone:z.string().max(40).optional().default(""),
  actualShippingCost:z.coerce.number().min(0).max(10000000).optional().default(0),
  scheduledFor:z.string().datetime().nullable().optional(),
  notes:z.string().max(600).optional().default("")
});

type FulfillmentOrder = {
  id: string;
  user_id: string | null;
  status: string;
  shipping_method: string;
  customer_name: string | null;
  customer_phone: string | null;
};

function customerMessage(order:FulfillmentOrder,status:string,input:z.infer<typeof schema>){
  const ref=String(order.id).slice(0,8).toUpperCase();
  if(status==="PREPARING") return `FZAC: pago confirmado. Tu pedido ${ref} está en preparación.`;
  if(status==="READY_FOR_PICKUP") return `FZAC: tu pedido ${ref} ya está listo para retirar. Respondé este mensaje para coordinar el horario.`;
  if(status==="READY_FOR_DELIVERY") return `FZAC: tu pedido ${ref} está listo para despacho.${input.estimatedWindow ? ` Horario estimado: ${input.estimatedWindow}.` : ""}`;
  if(status==="OUT_FOR_DELIVERY") return `FZAC: tu pedido ${ref} fue despachado.${input.estimatedWindow ? ` Horario estimado: ${input.estimatedWindow}.` : ""}${input.carrierPhone ? ` Teléfono del flete: ${input.carrierPhone}.` : ""}`;
  return `FZAC: tu pedido ${ref} fue entregado. Gracias por tu compra.`;
}

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
  const trusted=validateJsonMutationRequest(request,32*1024);
  if(!trusted.ok) return jsonError(trusted.message,trusted.status);
  const ctx=await getAdminApiContext(request,{scope:"admin-order-fulfillment",limit:60});
  if(!ctx.ok) return ctx.response;
  const {id}=await params;
  const body=schema.safeParse(await request.json().catch(()=>null));
  if(!body.success) return jsonError(body.error.issues[0]?.message ?? "Datos logísticos inválidos.",422);

  const {data:order}=await ctx.admin.from("orders")
    .select("id,user_id,status,shipping_method,customer_name,customer_phone")
    .eq("id",id).maybeSingle();
  if(!order) return jsonError("Pedido no encontrado.",404);
  if(["CANCELLED","COMPLETED"].includes(String(order.status))) return jsonError("El pedido ya está cerrado.",409);
  if(!["PAID","CONFIRMED","PREPARING","READY_FOR_PICKUP","READY_FOR_DELIVERY","OUT_FOR_DELIVERY","DELIVERED"].includes(String(order.status))) {
    return jsonError("El pedido todavía no está pagado.",409);
  }
  if(body.data.status==="READY_FOR_PICKUP" && order.shipping_method==="DELIVERY") return jsonError("Este pedido es para envío.",409);
  if(["READY_FOR_DELIVERY","OUT_FOR_DELIVERY"].includes(body.data.status) && order.shipping_method!=="DELIVERY") return jsonError("Este pedido es para retiro.",409);

  const now=new Date().toISOString();
  const patch:TablesUpdate<"orders">={
    status:body.data.status,
    assigned_to:body.data.assignedTo ?? null,
    carrier_name:body.data.carrierName || null,
    carrier_phone:body.data.carrierPhone || null,
    estimated_delivery_window:body.data.estimatedWindow || null,
    delivery_recipient_name:body.data.recipientName || null,
    delivery_recipient_phone:body.data.recipientPhone || null,
    actual_shipping_cost:body.data.actualShippingCost,
    scheduled_for:body.data.scheduledFor ?? null,
    fulfillment_notes:body.data.notes || null,
    status_updated_at:now,
    updated_at:now
  };
  if(body.data.status==="READY_FOR_PICKUP" || body.data.status==="READY_FOR_DELIVERY") patch.ready_at=now;
  if(body.data.status==="OUT_FOR_DELIVERY") patch.dispatched_at=now;
  if(body.data.status==="DELIVERED"){patch.delivered_at=now;patch.closed_at=now;}

  const {data:updated,error}=await ctx.admin.from("orders").update(patch).eq("id",id).select("id,status").maybeSingle();
  if(error || !updated) return jsonError("No pudimos actualizar el estado logístico.",409);

  const msg=customerMessage(order,body.data.status,body.data);
  let wa:"NOT_REQUESTED"|"DRY_RUN"|"SENT"|"FAILED"="NOT_REQUESTED";
  let providerMessageId:string|null=null;
  if(order.customer_phone){
    const sent=await sendWhatsAppText(String(order.customer_phone),msg);
    wa=sent.status; providerMessageId=sent.providerMessageId;
  }
  await ctx.admin.from("order_status_events").insert({
    order_id:id,from_status:order.status,to_status:body.data.status,note:body.data.notes || null,
    actor_id:ctx.profile.id,customer_visible:true,whatsapp_status:wa,whatsapp_provider_message_id:providerMessageId
  });
  if(order.user_id){
    await ctx.admin.from("notifications").insert({
      user_id:order.user_id,type:"ORDER_STATUS_UPDATED",title:"Tu pedido cambió de estado",message:msg,link_to:"/cuenta/pedidos"
    });
  }
  await ctx.admin.from("admin_audit_logs").insert({
    actor_id:ctx.profile.id,actor_email:ctx.profile.email,actor_role:ctx.profile.role,
    action:"ORDER_FULFILLMENT_UPDATED",entity:"orders",entity_id:id,
    message:`Estado logístico: ${String(order.status)} → ${body.data.status}`,
    metadata:{whatsapp_status:wa,assigned_to:body.data.assignedTo ?? null}
  });
  return Response.json({ok:true,status:body.data.status,whatsapp:wa});
}