"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, MessageCircle, PackageCheck, Save, Truck, UserRound, XCircle } from "lucide-react";
import { AdminInteractiveTable } from "@/components/admin/admin-interactive-table";
import { getWhatsAppHref } from "@/lib/utils/contact";

type OrderRow = Record<string, string | number | null | undefined>;
type Assignee = { id: string; label: string; role: string };
type FulfillmentStatus = "PREPARING" | "READY_FOR_PICKUP" | "READY_FOR_DELIVERY" | "OUT_FOR_DELIVERY" | "DELIVERED";

const columns = ["Referencia", "Cliente", "Email", "Telefono", "Productos", "Total", "Estado", "Pago", "Envio", "Fecha"];

const labels: Record<FulfillmentStatus,string> = {
  PREPARING:"Preparando",
  READY_FOR_PICKUP:"Listo para retirar",
  READY_FOR_DELIVERY:"Listo para despacho",
  OUT_FOR_DELIVERY:"En camino",
  DELIVERED:"Entregado"
};

function nextStatuses(delivery:boolean):FulfillmentStatus[]{
  return delivery
    ? ["PREPARING","READY_FOR_DELIVERY","OUT_FOR_DELIVERY","DELIVERED"]
    : ["PREPARING","READY_FOR_PICKUP","DELIVERED"];
}

function FulfillmentEditor({
  row,
  assignees,
  disabled,
  onSaved
}:{
  row:OrderRow;
  assignees:Assignee[];
  disabled:boolean;
  onSaved:(message:string)=>void;
}) {
  const delivery=row.__shippingMethod==="DELIVERY";
  const current=String(row.__statusRaw || "PREPARING");
  const allowed=nextStatuses(delivery);
  const initial=(allowed.includes(current as FulfillmentStatus) ? current : "PREPARING") as FulfillmentStatus;
  const [status,setStatus]=useState<FulfillmentStatus>(initial);
  const [assignedTo,setAssignedTo]=useState(String(row.__assignedTo || ""));
  const [carrierName,setCarrierName]=useState(String(row.__carrierName || ""));
  const [carrierPhone,setCarrierPhone]=useState(String(row.__carrierPhone || ""));
  const [estimatedWindow,setEstimatedWindow]=useState(String(row.__estimatedWindow || ""));
  const [recipientName,setRecipientName]=useState(String(row.__recipientName || ""));
  const [recipientPhone,setRecipientPhone]=useState(String(row.__recipientPhone || row.Telefono || ""));
  const [actualShippingCost,setActualShippingCost]=useState(String(row.__actualShippingCost ?? "0"));
  const [notes,setNotes]=useState(String(row.__fulfillmentNotes || ""));
  const [saving,setSaving]=useState(false);

  async function save(){
    if(saving) return;
    setSaving(true);
    const response=await fetch(`/api/admin/orders/${row.Id}/fulfillment`,{
      method:"PATCH",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        status,
        assignedTo:assignedTo || null,
        carrierName,
        carrierPhone,
        estimatedWindow,
        recipientName,
        recipientPhone,
        actualShippingCost:Number(actualShippingCost || 0),
        notes
      })
    });
    const body=await response.json().catch(()=>({})) as {message?:string;whatsapp?:string};
    setSaving(false);
    if(!response.ok){onSaved(body.message || "No pudimos actualizar la logística.");return;}
    onSaved(`Pedido actualizado a ${labels[status]}. WhatsApp: ${body.whatsapp || "sin envío"}.`);
    window.location.reload();
  }

  return <div className="admin-fulfillment-editor">
    <div className="admin-fulfillment-editor__grid">
      <label>Estado<select value={status} onChange={(event)=>setStatus(event.target.value as FulfillmentStatus)}>{allowed.map((value)=><option key={value} value={value}>{labels[value]}</option>)}</select></label>
      <label><UserRound size={14}/> Responsable<select value={assignedTo} onChange={(event)=>setAssignedTo(event.target.value)}><option value="">Sin asignar</option>{assignees.map((item)=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      {delivery ? <>
        <label>Flete / transportista<input value={carrierName} onChange={(event)=>setCarrierName(event.target.value)} placeholder="Nombre o empresa"/></label>
        <label>Teléfono flete<input value={carrierPhone} onChange={(event)=>setCarrierPhone(event.target.value)} placeholder="+54..."/></label>
        <label>Horario estimado<input value={estimatedWindow} onChange={(event)=>setEstimatedWindow(event.target.value)} placeholder="14:00–17:00"/></label>
        <label>Costo real flete<input inputMode="decimal" value={actualShippingCost} onChange={(event)=>setActualShippingCost(event.target.value.replace(/[^0-9.,]/g,"").replace(",","."))}/></label>
      </> : null}
      <label>Recibe<input value={recipientName} onChange={(event)=>setRecipientName(event.target.value)} placeholder={String(row.Cliente || "Cliente")}/></label>
      <label>Teléfono receptor<input value={recipientPhone} onChange={(event)=>setRecipientPhone(event.target.value)}/></label>
      <label className="admin-fulfillment-editor__wide">Observaciones<textarea rows={2} value={notes} onChange={(event)=>setNotes(event.target.value)} placeholder="Indicaciones de preparación, retiro o entrega"/></label>
    </div>
    <button className="btn btn--primary" type="button" disabled={disabled || saving} onClick={()=>void save()}><Save size={16}/>{saving ? "Guardando..." : "Guardar y avisar"}</button>
  </div>;
}

export function AdminOrdersView({ rows, assignees = [] }: { rows: OrderRow[]; assignees?: Assignee[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function updateOrder(id: string, action: "approve" | "reject") {
    if (busy) return;
    setBusy(`${action}-${id}`);
    setMessage("");
    const response = await fetch(`/api/admin/orders/${id}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: action === "reject" ? JSON.stringify({ reason: "Rechazada desde panel FZAC." }) : "{}"
    });
    const data = (await response.json().catch(() => ({}))) as { message?: string };
    setMessage(data.message || (response.ok ? "Orden actualizada." : "No pudimos actualizar la orden."));
    setBusy(null);
    if (response.ok) window.location.reload();
  }

  const approvalRows = useMemo(()=>rows.filter((row) => row.__statusRaw === "PENDING_ADMIN_APPROVAL"),[rows]);
  const fulfillmentRows = useMemo(()=>rows.filter((row) => ["PAID","CONFIRMED","PREPARING","READY_FOR_PICKUP","READY_FOR_DELIVERY","OUT_FOR_DELIVERY"].includes(String(row.__statusRaw))),[rows]);

  return <>
    {fulfillmentRows.length ? <section className="admin-large-purchases">
      {fulfillmentRows.map((row)=>{
        const delivery=row.__shippingMethod==="DELIVERY";
        return <article className="admin-large-purchase-card admin-fulfillment-card" key={`fulfillment-${row.Id}`}>
          <div>
            <span className="kicker">{delivery ? "LOGÍSTICA · DESPACHO" : "LOGÍSTICA · RETIRO"}</span>
            <h2>{row.Cliente}</h2>
            <p>{delivery
              ? `${row.__address || "Dirección pendiente"} · ${row.Telefono || "sin teléfono"}`
              : `Preparar mercadería para retiro en local · ${row.Telefono || "sin teléfono"}`}</p>
          </div>
          <strong>{row.Total}</strong>
          <small>{row.Productos}</small>
          <FulfillmentEditor row={row} assignees={assignees} disabled={Boolean(busy)} onSaved={setMessage}/>
          <a className="btn btn--ghost" href={getWhatsAppHref(`Hola ${row.Cliente}, te contactamos por el pedido ${row.Referencia}. ${delivery ? "Queremos coordinar el despacho." : "Queremos coordinar el retiro en nuestro local."}`)} target="_blank" rel="noreferrer">
            <MessageCircle size={17}/> Abrir WhatsApp
          </a>
        </article>;
      })}
    </section> : null}

    {approvalRows.length ? <section className="admin-large-purchases">
      {approvalRows.map((row)=><article className="admin-large-purchase-card" key={String(row.Id)}>
        <div><span className="kicker">PRIORIDAD ALTA · Compra &gt; $1.000.000</span><h2>{row.Cliente}</h2><p>Revisá monto, stock y contacto antes de habilitar el pago.</p></div>
        <strong>{row.Total}</strong><small>{row.Productos}</small>
        <div>
          <button className="btn" type="button" disabled={Boolean(busy)} onClick={()=>void updateOrder(String(row.Id),"approve")}><CheckCircle2 size={17}/> Aprobar compra</button>
          <button className="btn btn--ghost" type="button" disabled={Boolean(busy)} onClick={()=>void updateOrder(String(row.Id),"reject")}><XCircle size={17}/> Rechazar</button>
          <a className="btn btn--ghost" href={getWhatsAppHref(`Hola, te contactamos desde FZAC por la compra ${row.Referencia}.`)} target="_blank" rel="noreferrer"><MessageCircle size={17}/> Contactar</a>
        </div>
      </article>)}
    </section> : null}

    {message ? <p className="notice notice--success" role="status">{message}</p> : null}
    <AdminInteractiveTable title="Pedidos" columns={columns} rows={rows}/>
  </>;
}
