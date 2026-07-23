"use client";

import type { FormEvent } from "react";
import { useMemo, useRef, useState } from "react";
import {
  isSafeUserNote,
  isValidArgentinePhone,
  limitPhoneInput,
  normalizeUserNote
} from "@/lib/validations/security";

type FormState = {
  fullName: string;
  email: string;
  phone: string;
  orderNumber: string;
  reason: "PURCHASE_REGRET" | "WRONG_PRODUCT" | "DAMAGED_PRODUCT" | "NOT_DELIVERED" | "OTHER";
  preferredContact: "WHATSAPP" | "EMAIL" | "PHONE";
  details: string;
  accepted: boolean;
  company: string;
};

const initialState: FormState = {
  fullName: "",
  email: "",
  phone: "",
  orderNumber: "",
  reason: "PURCHASE_REGRET",
  preferredContact: "WHATSAPP",
  details: "",
  accepted: false,
  company: ""
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
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const requestInFlight = useRef(false);
  const idempotencyKey = useRef("");

  const validation = useMemo(() => ({
    fullName: /^[\p{L}\p{M}\s'.-]{2,90}$/u.test(form.fullName.trim()),
    email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(form.email.trim()),
    phone: isValidArgentinePhone(form.phone),
    orderNumber: !form.orderNumber.trim() || /^[a-zA-Z0-9-]{1,60}$/.test(form.orderNumber.trim()),
    details: normalizeUserNote(form.details, 900).length >= 10 && isSafeUserNote(form.details)
  }), [form]);

  const canSubmit = useMemo(() => {
    return Object.values(validation).every(Boolean) && form.accepted && !loading;
  }, [form.accepted, loading, validation]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
  }

  function markTouched(field: string) {
    setTouched((current) => ({ ...current, [field]: true }));
  }

  function feedback(field: keyof typeof validation, validMessage: string, invalidMessage: string) {
    if (!touched[field]) return null;
    return (
      <small className={`consumer-field-feedback ${validation[field] ? "is-valid" : "is-invalid"}`} role="status">
        {validation[field] ? validMessage : invalidMessage}
      </small>
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || requestInFlight.current) return;
    setTouched({ fullName: true, email: true, phone: true, orderNumber: true, details: true });
    if (!canSubmit) {
      setError("Revisá los campos marcados antes de registrar la solicitud.");
      return;
    }
    requestInFlight.current = true;
    setLoading(true);
    setError("");
    setMessage("");
    setRequestNumber("");

    try {
      if (!idempotencyKey.current) idempotencyKey.current = window.crypto.randomUUID();
      const response = await fetch("/api/consumer/refund-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, idempotencyKey: idempotencyKey.current })
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
      setTouched({});
      idempotencyKey.current = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos registrar la solicitud.");
    } finally {
      requestInFlight.current = false;
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
        <label className="consumer-refund-form__honeypot" aria-hidden="true">
          Empresa
          <input
            value={form.company}
            onChange={(event) => update("company", event.target.value)}
            autoComplete="off"
            tabIndex={-1}
          />
        </label>
        <label>
          Nombre y apellido
          <input
            value={form.fullName}
            onChange={(event) => update("fullName", event.target.value)}
            onBlur={() => markTouched("fullName")}
            autoComplete="name"
            maxLength={90}
            required
          />
          {feedback("fullName", "Nombre válido.", "Ingresá nombre y apellido usando solo letras.")}
        </label>
        <label>
          Email
          <input
            value={form.email}
            onChange={(event) => update("email", event.target.value)}
            onBlur={() => markTouched("email")}
            type="email"
            autoComplete="email"
            maxLength={120}
            required
          />
          {feedback("email", "Email válido.", "Ingresá un email con @ y dominio válido.")}
        </label>
        <label>
          Teléfono
          <input
            value={form.phone}
            onChange={(event) => update("phone", limitPhoneInput(event.target.value))}
            onBlur={() => markTouched("phone")}
            inputMode="tel"
            autoComplete="tel"
            maxLength={18}
            placeholder="+54 9 341..."
            required
          />
          {feedback("phone", "Teléfono válido.", "Ingresá entre 10 y 13 dígitos, con código de área.")}
        </label>
        <label>
          Número de pedido
          <input
            value={form.orderNumber}
            onChange={(event) => update("orderNumber", event.target.value)}
            onBlur={() => markTouched("orderNumber")}
            maxLength={60}
            placeholder="Opcional"
          />
          {feedback("orderNumber", "Referencia válida.", "Usá solo letras, números y guiones.")}
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
            onBlur={() => markTouched("details")}
            maxLength={900}
            placeholder="Contanos qué compra querés revisar, estado del producto y cualquier dato útil."
            required
          />
          {feedback("details", "Comentario válido.", "Escribí al menos 10 caracteres sin código ni enlaces sospechosos.")}
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
