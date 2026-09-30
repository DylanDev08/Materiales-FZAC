"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, RefreshCw, Warehouse } from "lucide-react";

type Location={id:string;code:string;name:string;kind:string};
type StockRow={
  product_id:string;location_id:string;quantity:number;stock_minimum:number;updated_at:string;
  product:{name?:string;sku?:string;unit?:string;stock?:number;active?:boolean}|Array<{name?:string;sku?:string;unit?:string;stock?:number;active?:boolean}>|null;
};
type SupplierStockRow={
  product_id:string;
  supplier_stock:number|null;
  supplier_stock_checked_at:string|null;
  supplier:{name?:string}|Array<{name?:string}>|null;
};

function productOf(row:StockRow){ return Array.isArray(row.product) ? row.product[0] : row.product; }

export function AdminInventoryLocations(){
  const [locations,setLocations]=useState<Location[]>([]);
  const [rows,setRows]=useState<StockRow[]>([]);
  const [supplierRows,setSupplierRows]=useState<SupplierStockRow[]>([]);
  const [loading,setLoading]=useState(true);
  const [message,setMessage]=useState("");
  const [productId,setProductId]=useState("");
  const [from,setFrom]=useState("");
  const [to,setTo]=useState("");
  const [quantity,setQuantity]=useState("1");
  const [saving,setSaving]=useState(false);

  async function load(){

    try{
      const response=await fetch("/api/admin/inventory/locations",{cache:"no-store"});
      const body=await response.json() as {locations?:Location[];rows?:StockRow[];supplierRows?:SupplierStockRow[];message?:string};
      if(!response.ok) throw new Error(body.message || "No pudimos cargar ubicaciones.");
      setLocations(body.locations ?? []);
      setRows(body.rows ?? []);
      setSupplierRows(body.supplierRows ?? []);
      setFrom((current)=>current || body.locations?.[0]?.id || "");
      setTo((current)=>current || body.locations?.[1]?.id || "");
    }catch(error){setMessage(error instanceof Error ? error.message : "No pudimos cargar ubicaciones.");}
    finally{setLoading(false);}
  }
  useEffect(()=>{
    const timer=window.setTimeout(()=>{void load();},0);
    return ()=>window.clearTimeout(timer);
  },[]);

  const products=useMemo(()=>{
    const map=new Map<string,{id:string;name:string;sku:string;unit:string;total:number;locations:Record<string,number>}>();
    for(const row of rows){
      const product=productOf(row);
      if(!product?.active) continue;
      const current=map.get(row.product_id) ?? {id:row.product_id,name:product.name || "Producto",sku:product.sku || "",unit:product.unit || "un.",total:Number(product.stock || 0),locations:{}};
      current.locations[row.location_id]=Number(row.quantity || 0);
      map.set(row.product_id,current);
    }
    return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name,"es"));
  },[rows]);

  const selected=products.find((item)=>item.id===productId);
  const selectedSupplier=supplierRows.find((item)=>item.product_id===productId);
  const supplierName=selectedSupplier
    ? (Array.isArray(selectedSupplier.supplier) ? selectedSupplier.supplier[0]?.name : selectedSupplier.supplier?.name)
    : "";
  async function transfer(){
    if(!productId || !from || !to || from===to) return;
    setSaving(true);setMessage("");
    try{
      const response=await fetch("/api/admin/inventory/locations",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({action:"TRANSFER",productId,fromLocationId:from,toLocationId:to,quantity:Number(quantity)})
      });
      const body=await response.json() as {message?:string};
      if(!response.ok) throw new Error(body.message || "No pudimos transferir stock.");
      setMessage(body.message || "Transferencia registrada.");
      await load();
    }catch(error){setMessage(error instanceof Error ? error.message : "No pudimos transferir stock.");}
    finally{setSaving(false);}
  }

  return <section className="admin-panel admin-location-stock">
    <header><div><span className="kicker">Ubicaciones</span><h2>Local, depósito y stock total</h2><p>El total sigue siendo el stock comercial. Las ubicaciones sirven para saber dónde está físicamente la mercadería.</p></div><button className="btn btn--ghost" disabled={loading} onClick={()=>{setLoading(true);setMessage("");void load();}} type="button"><RefreshCw className={loading ? "is-spinning" : undefined} size={17}/>Actualizar</button></header>
    {message ? <p className="notice" role="status">{message}</p> : null}
    <div className="admin-location-stock__summary">
      {locations.map((location)=><article key={location.id}><Warehouse size={18}/><strong>{location.name}</strong><span>{products.reduce((sum,p)=>sum+(p.locations[location.id] || 0),0)} un.</span></article>)}
    </div>
    <div className="admin-location-stock__transfer">
      <label>Producto<select value={productId} onChange={(e)=>setProductId(e.target.value)}><option value="">Elegí un producto</option>{products.map((p)=><option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}</select></label>
      <label>Desde<select value={from} onChange={(e)=>setFrom(e.target.value)}>{locations.map((l)=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
      <label>Hacia<select value={to} onChange={(e)=>setTo(e.target.value)}>{locations.map((l)=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
      <label>Cantidad<input min="1" type="number" value={quantity} onChange={(e)=>setQuantity(e.target.value)}/></label>
      <button className="btn btn--primary" type="button" disabled={saving || !productId || from===to} onClick={()=>void transfer()}><ArrowRightLeft size={17}/>{saving ? "Moviendo…" : "Transferir"}</button>
    </div>
    {selected ? <p className="admin-location-stock__selected">
      Stock FZAC total: <strong>{selected.total} {selected.unit}</strong> · {locations.map((l)=>`${l.name}: ${selected.locations[l.id] || 0}`).join(" · ")}
      {supplierName ? <> · Proveedor {supplierName}: <strong>{selectedSupplier?.supplier_stock == null ? "sin dato" : `${selectedSupplier.supplier_stock} ${selected.unit}`}</strong></> : null}
    </p> : null}
  </section>;
}
