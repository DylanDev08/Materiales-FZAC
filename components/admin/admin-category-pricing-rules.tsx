"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Save, SlidersHorizontal } from "lucide-react";

type Row={
  category_id:string;
  target_margin_pct:number|string;
  auto_update_threshold_pct:number|string;
  alert_over_market_pct:number|string;
  active:boolean;
  updated_at:string;
  category:{name?:string;slug?:string}|Array<{name?:string;slug?:string}>|null;
};

function categoryName(row:Row){
  const value=Array.isArray(row.category) ? row.category[0] : row.category;
  return value?.name ?? "Categoría";
}

export function AdminCategoryPricingRules(){
  const [rows,setRows]=useState<Row[]>([]);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState("");
  const [message,setMessage]=useState("");

  async function load(){

    try{
      const response=await fetch("/api/admin/category-pricing-rules",{cache:"no-store"});
      const body=await response.json() as {rows?:Row[];message?:string};
      if(!response.ok) throw new Error(body.message || "No pudimos cargar las reglas.");
      setRows(body.rows ?? []);
    }catch(error){setMessage(error instanceof Error ? error.message : "No pudimos cargar las reglas.");}
    finally{setLoading(false);}
  }

  useEffect(()=>{
    const timer=window.setTimeout(()=>{void load();},0);
    return ()=>window.clearTimeout(timer);
  },[]);

  function patch(id:string,key:keyof Row,value:unknown){
    setRows((current)=>current.map((row)=>row.category_id===id ? {...row,[key]:value} : row));
  }

  async function save(row:Row){
    setSaving(row.category_id); setMessage("");
    try{
      const response=await fetch("/api/admin/category-pricing-rules",{
        method:"PUT",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          categoryId:row.category_id,
          targetMarginPct:Number(row.target_margin_pct),
          autoUpdateThresholdPct:Number(row.auto_update_threshold_pct),
          alertOverMarketPct:Number(row.alert_over_market_pct),
          active:row.active
        })
      });
      const body=await response.json() as {message?:string};
      if(!response.ok) throw new Error(body.message || "No pudimos guardar la regla.");
      setMessage(body.message || "Regla guardada.");
    }catch(error){setMessage(error instanceof Error ? error.message : "No pudimos guardar la regla.");}
    finally{setSaving("");}
  }

  return <section className="admin-panel admin-category-pricing">
    <header>
      <div><span className="kicker">Política comercial</span><h2>Margen y alertas por categoría</h2><p>El cron diario usa estas reglas. Cambios de costo normales se aplican; los que superan el umbral quedan para revisión.</p></div>
      <button className="btn btn--ghost" disabled={loading} type="button" onClick={()=>{setLoading(true);setMessage("");void load();}}><RefreshCw className={loading ? "is-spinning" : undefined} size={17}/>Actualizar</button>
    </header>
    {message ? <p className="notice" role="status">{message}</p> : null}
    {loading && !rows.length ? <p className="admin-empty">Cargando categorías…</p> : null}
    <div className="admin-category-pricing__grid">
      {rows.map((row)=><article key={row.category_id}>
        <div className="admin-category-pricing__title"><SlidersHorizontal size={18}/><strong>{categoryName(row)}</strong></div>
        <label>Margen objetivo %<input inputMode="decimal" value={String(row.target_margin_pct)} onChange={(e)=>patch(row.category_id,"target_margin_pct",e.target.value)}/></label>
        <label>Variación máxima automática %<input inputMode="decimal" value={String(row.auto_update_threshold_pct)} onChange={(e)=>patch(row.category_id,"auto_update_threshold_pct",e.target.value)}/></label>
        <label>Alerta sobre mercado %<input inputMode="decimal" value={String(row.alert_over_market_pct)} onChange={(e)=>patch(row.category_id,"alert_over_market_pct",e.target.value)}/></label>
        <label className="admin-category-pricing__active"><input type="checkbox" checked={row.active} onChange={(e)=>patch(row.category_id,"active",e.target.checked)}/>Regla activa</label>
        <button className="btn btn--primary" disabled={Boolean(saving)} type="button" onClick={()=>void save(row)}><Save size={16}/>{saving===row.category_id ? "Guardando…" : "Guardar"}</button>
      </article>)}
    </div>
  </section>;
}
