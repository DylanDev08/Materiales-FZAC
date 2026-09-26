"use client";

import { FormEvent, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Loader2, Mail } from "lucide-react";
import { normalizeEmail } from "@/lib/validations/auth";
import { TurnstileWidget } from "@/components/auth/turnstile-widget";

export function ForgotPasswordForm() {
  const requestRef = useRef(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const turnstileEnabled = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim());

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (requestRef.current) return;
    const normalizedEmail = normalizeEmail(email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError("Ingresá un email válido.");
      return;
    }

    if (turnstileEnabled && !captchaToken) {
      setError("Completá la verificación anti-bot.");
      return;
    }

    requestRef.current = true;
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, captchaToken })
      });
      const data = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) throw new Error(data.message || "No pudimos iniciar la recuperación.");
      setMessage(data.message || "Si la cuenta existe, vas a recibir un enlace de recuperación.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No pudimos iniciar la recuperación.");
    } finally {
      if (turnstileEnabled) setCaptchaResetKey((current) => current + 1);
      requestRef.current = false;
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-panel auth-panel--recovery">
        <div className="auth-panel__head">
          <span className="brand__mark brand__mark--logo auth-logo"><Image src="/logoFZAC.jpg" alt="FZAC" width={58} height={58} /></span>
          <div>
            <span className="kicker">Recuperar acceso</span>
            <h1>Volver a tu cuenta FZAC</h1>
            <p>Te enviaremos un enlace seguro y temporal. Nunca te pediremos la contraseña por email.</p>
          </div>
        </div>
        <form onSubmit={submit}>
          <label className="field">
            Email de la cuenta
            <input type="email" value={email} onChange={(event) => { setEmail(event.target.value); setError(""); }} autoComplete="email" required aria-invalid={Boolean(error)} />
            {error ? <span className="auth-field-error">{error}</span> : null}
          </label>
          {turnstileEnabled ? <TurnstileWidget action="recover" onToken={setCaptchaToken} resetKey={captchaResetKey} /> : null}
          <button className="btn" type="submit" disabled={loading || (turnstileEnabled && !captchaToken)}>
            {loading ? <Loader2 className="is-spinning" size={18} /> : <Mail size={18} />}
            {loading ? "Enviando..." : "Enviar enlace seguro"}
          </button>
        </form>
        {message ? <p className="notice notice--success">{message}</p> : null}
        <Link className="auth-back-link" href="/login">Volver a ingresar</Link>
      </section>
    </main>
  );
}
