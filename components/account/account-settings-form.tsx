"use client";

import { FormEvent, useState } from "react";
import { CheckCircle, Loader2, Save } from "lucide-react";
import type { SessionProfile } from "@/lib/auth/get-user";

export function AccountSettingsForm({ profile }: { profile: SessionProfile }) {
  const [form, setForm] = useState({
    full_name: profile.full_name ?? "",
    phone: profile.phone ?? "",
    avatar_url: profile.avatar_url ?? ""
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    setMessage("");
    setOk(false);

    try {
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message || "No pudimos guardar tus datos.");
      setOk(true);
      setMessage("Datos guardados correctamente.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No pudimos actualizar la cuenta.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="account-settings-form" onSubmit={submit}>
      <div className="form-grid">
        <label>
          Nombre y apellido
          <input
            value={form.full_name}
            onChange={(event) => setForm((current) => ({ ...current, full_name: event.target.value }))}
            minLength={2}
            maxLength={120}
            required
            autoComplete="name"
          />
        </label>
        <label>
          Telefono
          <input
            value={form.phone}
            onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
            minLength={6}
            maxLength={40}
            required
            autoComplete="tel"
          />
        </label>
        <label className="field--wide">
          Foto de perfil
          <input
            value={form.avatar_url}
            onChange={(event) => setForm((current) => ({ ...current, avatar_url: event.target.value }))}
            placeholder="https://..."
            autoComplete="url"
          />
        </label>
      </div>
      <button className="btn account-settings-form__button" type="submit" disabled={loading}>
        {loading ? <Loader2 size={17} /> : ok ? <CheckCircle size={17} /> : <Save size={17} />}
        {loading ? "Guardando" : "Guardar datos"}
      </button>
      {message ? <p className={ok ? "notice notice--success" : "notice notice--danger"}>{message}</p> : null}
    </form>
  );
}
