"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, ImageIcon, Loader2, RotateCcw, Save, UserRound } from "lucide-react";
import type { SessionProfile } from "@/lib/auth/get-user";
import { isValidArgentinePhone, limitPhoneInput, normalizePhoneDigits } from "@/lib/validations/security";

export function AccountSettingsForm({ profile }: { profile: SessionProfile }) {
  const router = useRouter();
  const initial = { full_name: profile.full_name ?? "", phone: profile.phone ?? "", avatar_url: profile.avatar_url ?? "" };
  const [form, setForm] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState(false);
  const dirty = form.full_name !== saved.full_name || form.phone !== saved.phone;

  const errors = useMemo(() => {
    const next: { full_name?: string; phone?: string } = {};
    const fullName = form.full_name.trim();
    if (fullName.length < 2) next.full_name = "Ingresá tu nombre y apellido.";
    else if (!/^[\p{L}\p{M}\s.'-]+$/u.test(fullName)) next.full_name = "Usá únicamente letras y separadores habituales.";
    if (!isValidArgentinePhone(form.phone)) next.phone = "Ingresá un teléfono argentino válido.";
    return next;
  }, [form]);
  const formValid = Object.keys(errors).length === 0;

  function updateField(field: "full_name" | "phone", value: string) {
    setOk(false);
    setMessage("");
    setTouched((current) => ({ ...current, [field]: true }));
    setForm((current) => ({ ...current, [field]: value }));
  }

  function reset() {
    setForm(saved);
    setTouched({});
    setMessage("");
    setOk(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || !dirty) return;
    if (!formValid) {
      setTouched({ full_name: true, phone: true });
      setMessage("Revisá los campos señalados antes de guardar.");
      return;
    }
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
      setSaved(form);
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
    <form className="account-settings-form" onSubmit={submit} noValidate>
      <div className="account-settings-form__avatar">
        <span>{form.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={form.avatar_url} alt="Foto de perfil" referrerPolicy="no-referrer" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/logoFZAC.jpg" alt="Logo FZAC" />
        )}</span>
        <div><ImageIcon size={18} /><strong>Foto de perfil</strong><small>{form.avatar_url ? "Se usa la foto verificada de tu método de acceso." : "FZAC se usa como imagen segura de respaldo."}</small></div>
      </div>

      <div className="account-settings-form__fields">
        <header><UserRound size={19} /><div><strong>Datos para tus compras</strong><small>Se reutilizan en checkout y comprobantes para que no tengas que escribirlos otra vez.</small></div></header>
        <div className="form-grid">
          <label>Nombre y apellido
            <input value={form.full_name} onBlur={() => setTouched((current) => ({ ...current, full_name: true }))} onChange={(event) => updateField("full_name", event.target.value)} minLength={2} maxLength={120} required autoComplete="name" aria-invalid={touched.full_name && Boolean(errors.full_name)} aria-describedby="account-name-help" />
            <small id="account-name-help" className={touched.full_name ? errors.full_name ? "account-field-error" : "account-field-ok" : undefined}>{touched.full_name ? errors.full_name ?? "Nombre válido." : "Usaremos este nombre en pedidos y comprobantes."}</small>
          </label>
          <label>Teléfono
            <input value={form.phone} onBlur={() => setTouched((current) => ({ ...current, phone: true }))} onChange={(event) => updateField("phone", limitPhoneInput(event.target.value))} minLength={10} maxLength={18} required autoComplete="tel" inputMode="tel" aria-invalid={touched.phone && Boolean(errors.phone)} aria-describedby="account-phone-help" />
            <small id="account-phone-help" className={touched.phone ? errors.phone ? "account-field-error" : "account-field-ok" : undefined}>{touched.phone ? errors.phone ?? "Teléfono válido." : `${normalizePhoneDigits(form.phone).length}/13 dígitos`}</small>
          </label>
          <label className="field--wide">Email de acceso
            <input value={profile.email} readOnly aria-readonly="true" />
            <small>Se administra desde tu acceso de Fortaleza Construcciones o Google.</small>
          </label>
        </div>
      </div>

      <div className="account-settings-form__footer">
        <div className="account-settings-form__actions"><button className="btn" type="submit" disabled={loading || !dirty}>{loading ? <Loader2 className="is-spinning" size={17} /> : ok ? <CheckCircle size={17} /> : <Save size={17} />}{loading ? "Guardando" : "Guardar cambios"}</button><button className="btn btn--ghost" type="button" onClick={reset} disabled={loading || !dirty}><RotateCcw size={16} /> Descartar</button></div>
        {message ? <p role="status" className={ok ? "notice notice--success" : "notice notice--danger"}>{message}</p> : dirty ? <small className="account-unsaved">Tenés cambios sin guardar.</small> : null}
      </div>
    </form>
  );
}
