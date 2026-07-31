"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, ImageIcon, Loader2, Save, UserRound } from "lucide-react";
import type { SessionProfile } from "@/lib/auth/get-user";
import { isValidArgentinePhone, limitPhoneInput, normalizePhoneDigits } from "@/lib/validations/security";

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
  const [dirty, setDirty] = useState(false);

  const errors = useMemo(() => {
    const next: { full_name?: string; phone?: string; avatar_url?: string } = {};
    const fullName = form.full_name.trim();
    if (fullName.length < 2) next.full_name = "Ingresá tu nombre y apellido.";
    else if (!/^[\p{L}\p{M}\s.'-]+$/u.test(fullName)) next.full_name = "Usá únicamente letras y separadores habituales.";
    if (!isValidArgentinePhone(form.phone)) next.phone = "Ingresá un teléfono argentino válido.";
    if (form.avatar_url.trim()) {
      try {
        const url = new URL(form.avatar_url.trim());
        if (url.protocol !== "https:" || url.username || url.password) next.avatar_url = "La foto debe usar una URL HTTPS segura.";
      } catch {
        next.avatar_url = "Ingresá una URL de imagen válida.";
      }
    }
    return next;
  }, [form]);
  const formValid = Object.keys(errors).length === 0;

  function updateField(field: keyof typeof form, value: string) {
    setDirty(true);
    setOk(false);
    setMessage("");
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || !formValid || !dirty) return;

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
      setDirty(false);
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
            <input value={form.full_name} onChange={(event) => updateField("full_name", event.target.value)} minLength={2} maxLength={120} required autoComplete="name" aria-invalid={Boolean(errors.full_name)} />
            {errors.full_name ? <small className="account-field-error">{errors.full_name}</small> : <small>Usaremos este nombre en tus pedidos y comprobantes.</small>}
          </label>
          <label>
            Teléfono
            <input
              value={form.phone}
              onChange={(event) => updateField("phone", limitPhoneInput(event.target.value))}
              minLength={10}
              maxLength={18}
              required
              autoComplete="tel"
              inputMode="tel"
              aria-invalid={Boolean(errors.phone)}
            />
            <small className={errors.phone ? "account-field-error" : undefined}>{errors.phone ?? `${normalizePhoneDigits(form.phone).length}/13 dígitos`}</small>
          </label>
          <label className="field--wide">
            URL de foto personalizada (opcional)
            <input
              value={form.avatar_url}
              onChange={(event) => {
                setPreviewFailed(false);
                updateField("avatar_url", event.target.value);
              }}
              placeholder="https://..."
              autoComplete="url"
              aria-invalid={Boolean(errors.avatar_url)}
            />
            {errors.avatar_url ? <small className="account-field-error">{errors.avatar_url}</small> : null}
          </label>
          <label className="field--wide">
            Email de acceso
            <input value={profile.email} readOnly aria-readonly="true" />
            <small>El email se administra desde tu método de acceso de Fortaleza Construcciones o Google.</small>
          </label>
        </div>
      </div>

      <div className="account-settings-form__footer">
        <button className="btn account-settings-form__button" type="submit" disabled={loading || !formValid || !dirty}>
          {loading ? <Loader2 size={17} /> : ok ? <CheckCircle size={17} /> : <Save size={17} />}
          {loading ? "Guardando" : dirty ? "Guardar cambios" : "Datos actualizados"}
        </button>
        {message ? <p className={ok ? "notice notice--success" : "notice notice--danger"}>{message}</p> : null}
      </div>
    </form>
  );
}
