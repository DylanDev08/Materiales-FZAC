"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, ImageIcon, Loader2, Save, UserRound } from "lucide-react";
import type { SessionProfile } from "@/lib/auth/get-user";
import { limitPhoneInput, normalizePhoneDigits } from "@/lib/validations/security";

export function AccountSettingsForm({ profile }: { profile: SessionProfile }) {
  const router = useRouter();
  const [form, setForm] = useState({
    full_name: profile.full_name ?? "",
    phone: profile.phone ?? "",
    avatar_url: profile.avatar_url ?? ""
  });
  const [previewFailed, setPreviewFailed] = useState(false);
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
      setMessage("Tus datos quedaron actualizados.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No pudimos actualizar la cuenta.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="account-settings-form" onSubmit={submit}>
      <div className="account-settings-form__avatar">
        <span>
          {form.avatar_url && !previewFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.avatar_url} alt="Vista previa de la foto" referrerPolicy="no-referrer" onError={() => setPreviewFailed(true)} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/logoFZAC.jpg" alt="Logo FZAC" />
          )}
        </span>
        <div>
          <ImageIcon size={18} />
          <strong>Foto de perfil</strong>
          <small>Tu foto de Google se conserva. También podés usar una URL HTTPS propia.</small>
        </div>
      </div>

      <div className="account-settings-form__fields">
        <header><UserRound size={19} /><div><strong>Identidad y contacto</strong><small>Estos datos completan automáticamente el checkout.</small></div></header>
        <div className="form-grid">
          <label>
            Nombre y apellido
            <input value={form.full_name} onChange={(event) => setForm((current) => ({ ...current, full_name: event.target.value }))} minLength={2} maxLength={120} required autoComplete="name" />
          </label>
          <label>
            Teléfono
            <input
              value={form.phone}
              onChange={(event) => setForm((current) => ({ ...current, phone: limitPhoneInput(event.target.value) }))}
              minLength={10}
              maxLength={18}
              required
              autoComplete="tel"
              inputMode="tel"
            />
            <small>{normalizePhoneDigits(form.phone).length}/13 dígitos</small>
          </label>
          <label className="field--wide">
            URL de foto personalizada (opcional)
            <input
              value={form.avatar_url}
              onChange={(event) => {
                setPreviewFailed(false);
                setForm((current) => ({ ...current, avatar_url: event.target.value }));
              }}
              placeholder="https://..."
              autoComplete="url"
            />
          </label>
          <label className="field--wide">
            Email de acceso
            <input value={profile.email} readOnly aria-readonly="true" />
            <small>El email se administra desde tu método de acceso de Fortaleza Construcciones o Google.</small>
          </label>
        </div>
      </div>

      <div className="account-settings-form__footer">
        <button className="btn account-settings-form__button" type="submit" disabled={loading}>
          {loading ? <Loader2 size={17} /> : ok ? <CheckCircle size={17} /> : <Save size={17} />}
          {loading ? "Guardando" : "Guardar cambios"}
        </button>
        {message ? <p className={ok ? "notice notice--success" : "notice notice--danger"}>{message}</p> : null}
      </div>
    </form>
  );
}
