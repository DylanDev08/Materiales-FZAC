"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { limitPhoneInput } from "@/lib/validations/security";

type FormState = {
  fullName: string;
  email: string;
  phone: string;
  orderNumber: string;
  reason: "PURCHASE_REGRET" | "WRONG_PRODUCT" | "DAMAGED_PRODUCT" | "NOT_DELIVERED" | "OTHER";
  preferredContact: "WHATSAPP" | "EMAIL" | "PHONE";
  details: string;
  accepted: boolean;
};

const initialState: FormState = {
  fullName: "",
  email: "",
  phone: "",
  orderNumber: "",
  reason: "PURCHASE_REGRET",
  preferredContact: "WHATSAPP",
  details: "",
  accepted: false
};

const reasonOptions = [
  ["PURCHASE_REGRET", "Arrepentimiento de compra"],
  ["WRONG_PRODUCT", "Producto equivocado"],
  ["DAMAGED_PRODUCT", "Producto dañado"],
  ["NOT_DELIVERED", "Pedido no entregado"],
  ["OTHER", "Otro motivo"]
] as const;

export function ConsumerRefundForm() {
  const [form, setForm] = useState<FormState>(initialState);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [requestNumber, setRequestNumber] = useState("");
  const [error, setError] = useState("");

  const canSubmit = useMemo(() => {
    return Boolean(form.fullName.trim() && form.email.trim() && form.phone.trim() && form.details.trim() && form.accepted && !loading);
  }, [form, loading]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    setMessage("");
    setRequestNumber("");

    try {
      const response = await fetch("/api/consumer/refund-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        request_number?: string;
      };

      if (!response.ok || !data.ok) throw new Error(data.message || "No pudimos registrar la solicitud.");

      setRequestNumber(data.request_number || "");
      setMessage(data.message || "Solicitud registrada correctamente.");
      setForm(initialState);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos registrar la solicitud.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="consumer-refund-card" aria-labelledby="consumer-refund-title">
      <header>
        <span className="kicker">Solicitud online</span>
        <h2 id="consumer-refund-title">Iniciar trámite</h2>
        <p>
          Completá los datos y guardá el número de trámite. FZAC revisará la solicitud y te contactará por el medio
          elegido.
        </p>
      </header>

      <form className="consumer-refund-form form-grid" onSubmit={submit}>
        <label>
          Nombre y apellido
          <input
            value={form.fullName}
            onChange={(event) => update("fullName", event.target.value)}
            autoComplete="name"
            maxLength={90}
            required
          />
        </label>
        <label>
          Email
          <input
            value={form.email}
            onChange={(event) => update("email", event.target.value)}
            type="email"
            autoComplete="email"
            maxLength={120}
            required
          />
        </label>
        <label>
          Teléfono
          <input
            value={form.phone}
            onChange={(event) => update("phone", limitPhoneInput(event.target.value))}
            inputMode="tel"
            autoComplete="tel"
            maxLength={18}
            placeholder="+54 9 341..."
            required
          />
        </label>
        <label>
          Número de pedido
          <input
            value={form.orderNumber}
            onChange={(event) => update("orderNumber", event.target.value)}
            maxLength={60}
            placeholder="Opcional"
          />
        </label>
        <label>
          Motivo
          <select value={form.reason} onChange={(event) => update("reason", event.target.value as FormState["reason"])}>
            {reasonOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Medio de contacto
          <select
            value={form.preferredContact}
            onChange={(event) => update("preferredContact", event.target.value as FormState["preferredContact"])}
          >
            <option value="WHATSAPP">WhatsApp</option>
            <option value="EMAIL">Email</option>
            <option value="PHONE">Teléfono</option>
          </select>
        </label>
        <label>
          Comentario
          <textarea
            value={form.details}
            onChange={(event) => update("details", event.target.value)}
            maxLength={900}
            placeholder="Contanos qué compra querés revisar, estado del producto y cualquier dato útil."
            required
          />
        </label>
        <label className="consumer-refund-form__check">
          <input
            type="checkbox"
            checked={form.accepted}
            onChange={(event) => update("accepted", event.target.checked)}
          />
          Confirmo que quiero iniciar una solicitud de arrepentimiento o revisión de compra.
        </label>

        {error ? <p className="notice notice--danger">{error}</p> : null}
        {message ? (
          <p className="notice notice--success">
            {message}
            {requestNumber ? <strong> Trámite: {requestNumber}</strong> : null}
          </p>
        ) : null}

        <button className="btn legal-action-button" type="submit" disabled={!canSubmit}>
          {loading ? "Registrando solicitud..." : "Registrar solicitud"}
        </button>
      </form>
    </section>
  );
}
