"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Ban, CheckCircle2, Loader2, Plus, Scale } from "lucide-react";
import { currency } from "@/lib/formatters/currency";
import type { AdminFinancialMovement } from "@/lib/db/admin";

const categories = {
  INCOME: ["Venta fuera del sitio", "Ajuste positivo", "Servicio", "Otro ingreso"],
  EXPENSE: ["Compra de mercadería", "Logística", "Servicios", "Impuestos", "Mantenimiento", "Otro egreso"]
} as const;

function localDateTimeValue() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function movementDate(value: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function AdminFinancialManager({
  available,
  rows
}: {
  available: boolean;
  rows: AdminFinancialMovement[];
}) {
  const router = useRouter();
  const submitRef = useRef(false);
  const [type, setType] = useState<"INCOME" | "EXPENSE">("EXPENSE");
  const [category, setCategory] = useState<string>(categories.EXPENSE[0]);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [occurredAt, setOccurredAt] = useState(localDateTimeValue);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState(false);
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");

  const totals = useMemo(() => {
    const active = rows.filter((row) => row.status === "ACTIVE");
    const income = active.filter((row) => row.type === "INCOME").reduce((sum, row) => sum + row.amount, 0);
    const expense = active.filter((row) => row.type === "EXPENSE").reduce((sum, row) => sum + row.amount, 0);
    return { income, expense, balance: income - expense };
  }, [rows]);

  function selectType(nextType: "INCOME" | "EXPENSE") {
    setType(nextType);
    setCategory(categories[nextType][0]);
    setMessage("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitRef.current || !available) return;
    submitRef.current = true;
    setLoading(true);
    setMessage("");
    setOk(false);

    try {
      const response = await fetch("/api/admin/financial-movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          category,
          description,
          amount: Number(amount.replace(",", ".")),
          occurred_at: new Date(occurredAt).toISOString()
        })
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message || "No pudimos registrar el movimiento.");
      setDescription("");
      setAmount("");
      setOccurredAt(localDateTimeValue());
      setOk(true);
      setMessage("Movimiento registrado y métricas actualizadas.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No pudimos registrar el movimiento.");
    } finally {
      submitRef.current = false;
      setLoading(false);
    }
  }

  async function voidMovement() {
    if (!voidingId || loading) return;
    setLoading(true);
    setMessage("");
    setOk(false);
    try {
      const response = await fetch("/api/admin/financial-movements", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: voidingId, reason: voidReason })
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message || "No pudimos anular el movimiento.");
      setVoidingId(null);
      setVoidReason("");
      setOk(true);
      setMessage("Movimiento anulado. El registro permanece visible para auditoría.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No pudimos anular el movimiento.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-finance-page">
      {!available ? (
        <p className="notice notice--warning">
          El libro financiero todavía no existe en la base remota. Aplicá la migración pendiente antes de registrar movimientos.
        </p>
      ) : null}

      <section className="admin-finance-summary" aria-label="Resumen del libro manual">
        <article><ArrowUpRight size={20} /><span>Otros ingresos</span><strong>{currency(totals.income)}</strong></article>
        <article><ArrowDownRight size={20} /><span>Egresos</span><strong>{currency(totals.expense)}</strong></article>
        <article className={totals.balance < 0 ? "is-negative" : ""}><Scale size={20} /><span>Balance manual</span><strong>{currency(totals.balance)}</strong></article>
      </section>

      <div className="admin-finance-layout">
        <section className="admin-finance-entry">
          <header>
            <span className="kicker">Nuevo movimiento</span>
            <h2>Registrar ingreso o egreso</h2>
            <p>Las ventas aprobadas se suman automáticamente. Usá este formulario únicamente para otros movimientos de caja.</p>
          </header>

          <form onSubmit={submit}>
            <fieldset className="admin-finance-type" disabled={!available || loading}>
              <legend>Tipo de movimiento</legend>
              <button className={type === "INCOME" ? "is-active" : ""} type="button" onClick={() => selectType("INCOME")}>
                <ArrowUpRight size={18} /> Ingreso
              </button>
              <button className={type === "EXPENSE" ? "is-active" : ""} type="button" onClick={() => selectType("EXPENSE")}>
                <ArrowDownRight size={18} /> Egreso
              </button>
            </fieldset>
            <label>
              Categoría
              <select value={category} onChange={(event) => setCategory(event.target.value)} disabled={!available || loading}>
                {categories[type].map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>
            <label>
              Descripción
              <input value={description} onChange={(event) => setDescription(event.target.value)} minLength={3} maxLength={240} required disabled={!available || loading} />
            </label>
            <div className="admin-finance-entry__row">
              <label>
                Importe
                <input value={amount} onChange={(event) => setAmount(event.target.value.replace(/[^0-9.,]/g, ""))} inputMode="decimal" placeholder="0,00" required disabled={!available || loading} />
              </label>
              <label>
                Fecha y hora
                <input type="datetime-local" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} required disabled={!available || loading} />
              </label>
            </div>
            <button className="btn" type="submit" disabled={!available || loading || !description.trim() || !amount}>
              {loading ? <Loader2 size={18} className="spin" /> : <Plus size={18} />}
              {loading ? "Guardando" : "Registrar movimiento"}
            </button>
          </form>
        </section>

        <section className="admin-finance-ledger">
          <header>
            <div><span className="kicker">Historial auditable</span><h2>Últimos movimientos</h2></div>
            <span>{rows.length} registros</span>
          </header>
          {rows.length ? (
            <div className="admin-finance-table-wrap">
              <table>
                <thead><tr><th>Fecha</th><th>Tipo</th><th>Detalle</th><th>Importe</th><th>Estado</th><th>Acción</th></tr></thead>
                <tbody>
                  {rows.map((row) => (
                    <tr className={row.status === "VOID" ? "is-void" : ""} key={row.id}>
                      <td>{movementDate(row.occurredAt)}</td>
                      <td><span className={`admin-finance-kind admin-finance-kind--${row.type.toLowerCase()}`}>{row.type === "INCOME" ? "Ingreso" : "Egreso"}</span></td>
                      <td><strong>{row.description}</strong><small>{row.category}{row.source === "PURCHASE_PAYMENT" ? " · Automático" : ""}</small>{row.voidReason ? <em>Motivo: {row.voidReason}</em> : null}</td>
                      <td>{currency(row.amount)}</td>
                      <td>{row.status === "ACTIVE" ? "Vigente" : "Anulado"}</td>
                      <td>{row.status === "ACTIVE" && row.source !== "PURCHASE_PAYMENT" ? <button className="admin-finance-void" type="button" onClick={() => { setVoidingId(row.id); setVoidReason(""); }}><Ban size={15} /> Anular</button> : row.status === "ACTIVE" ? <Link className="admin-finance-manage" href="./cuentas-proveedores">Gestionar pago</Link> : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="admin-empty-state">Todavía no hay movimientos manuales. Las ventas aprobadas ya aparecen en el dashboard.</p>}
        </section>
      </div>

      {voidingId ? (
        <section className="admin-finance-void-panel" aria-live="polite">
          <div><Ban size={20} /><div><strong>Anular movimiento</strong><p>El registro seguirá visible y dejará de afectar las métricas.</p></div></div>
          <label>Motivo obligatorio<input value={voidReason} onChange={(event) => setVoidReason(event.target.value)} minLength={3} maxLength={240} autoFocus /></label>
          <div><button className="btn btn--ghost" type="button" onClick={() => setVoidingId(null)} disabled={loading}>Cancelar</button><button className="btn" type="button" onClick={voidMovement} disabled={loading || voidReason.trim().length < 3}>{loading ? <Loader2 size={17} className="spin" /> : <Ban size={17} />} Confirmar anulación</button></div>
        </section>
      ) : null}

      {message ? <p className={ok ? "notice notice--success" : "notice notice--danger"}>{ok ? <CheckCircle2 size={17} /> : null}{message}</p> : null}
    </div>
  );
}
