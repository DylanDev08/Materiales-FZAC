"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { CheckCircle, KeyRound, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { passwordChecks } from "@/lib/validations/auth";

export function ResetPasswordForm() {
  const router = useRouter();
  const requestRef = useRef(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const checks = useMemo(() => passwordChecks(password), [password]);
  const valid = checks.every((check) => check.ok) && password === confirmPassword;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (requestRef.current || !valid) {
      setError(password !== confirmPassword ? "Las contraseñas no coinciden." : "La contraseña no cumple todas las reglas.");
      return;
    }

    requestRef.current = true;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirmPassword })
      });
      const data = (await response.json().catch(() => ({}))) as { target?: string; message?: string };
      if (!response.ok) throw new Error(data.message || "No pudimos actualizar la contraseña.");
      setMessage(data.message || "Contraseña actualizada correctamente.");
      window.setTimeout(() => router.push(data.target || "/login"), 900);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No pudimos actualizar la contraseña.");
    } finally {
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
            <span className="kicker">Seguridad</span>
            <h1>Definí una nueva contraseña</h1>
            <p>El enlace solo habilita este cambio. Al terminar, se cerraran las sesiones anteriores.</p>
          </div>
        </div>
        <form onSubmit={submit}>
          <label className="field">
            Nueva contraseña
            <input type="password" value={password} onChange={(event) => { setPassword(event.target.value); setError(""); }} autoComplete="new-password" minLength={8} required />
          </label>
          <div className="password-checklist">
            {checks.map((check) => <span className={check.ok ? "is-ok" : ""} key={check.id}><CheckCircle size={15} /> {check.label}</span>)}
          </div>
          <label className="field">
            Confirmar contraseña
            <input type="password" value={confirmPassword} onChange={(event) => { setConfirmPassword(event.target.value); setError(""); }} autoComplete="new-password" minLength={8} required />
          </label>
          {error ? <p className="notice notice--danger">{error}</p> : null}
          {message ? <p className="notice notice--success">{message}</p> : null}
          <button className="btn" type="submit" disabled={loading || !valid}>
            {loading ? <Loader2 className="is-spinning" size={18} /> : <KeyRound size={18} />}
            {loading ? "Actualizando..." : "Guardar nueva contraseña"}
          </button>
        </form>
        <Link className="auth-back-link" href="/recuperar">Solicitar otro enlace</Link>
      </section>
    </main>
  );
}
