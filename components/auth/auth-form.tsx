"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle, Loader2, LogIn, MailWarning } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { normalizeEmail, passwordChecks } from "@/lib/validations/auth";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [hp, setHp] = useState("");
  const [emailExists, setEmailExists] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const normalizedEmail = useMemo(() => normalizeEmail(email), [email]);
  const checks = useMemo(() => passwordChecks(password, normalizedEmail, name), [password, normalizedEmail, name]);
  const passwordOk = checks.every((check) => check.ok);

  useEffect(() => {
    if (mode !== "register" || !normalizedEmail.includes("@")) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setCheckingEmail(true);
      try {
        const response = await fetch("/api/auth/email-exists", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: normalizedEmail }),
          signal: controller.signal
        });
        const data = (await response.json()) as { exists?: boolean };
        setEmailExists(Boolean(data.exists));
      } catch {
        if (!controller.signal.aborted) setEmailExists(false);
      } finally {
        if (!controller.signal.aborted) setCheckingEmail(false);
      }
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [mode, normalizedEmail]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    if (mode === "register") {
      if (emailExists) {
        setMessage("Ya existe una cuenta con ese email. Inicia sesion.");
        setLoading(false);
        return;
      }
      if (!passwordOk || password !== confirmPassword || !acceptedTerms) {
        setMessage("Revisa contrasena, confirmacion y terminos antes de registrarte.");
        setLoading(false);
        return;
      }
    }

    try {
      const response = await fetch(mode === "login" ? "/api/auth/login" : "/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "login"
            ? { email: normalizedEmail, password, hp }
            : { name, phone, email: normalizedEmail, password, confirmPassword, acceptedTerms, hp }
        )
      });
      const data = (await response.json()) as { target?: string; message?: string };
      if (!response.ok) throw new Error(data.message || "No pudimos completar la operacion.");
      window.location.assign(data.target || (mode === "login" ? "/cuenta" : "/login?registered=true"));
    } catch (authError) {
      setMessage(authError instanceof Error ? authError.message : "No pudimos conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  async function googleLogin() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setMessage("Supabase no esta configurado.");
      return;
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` }
    });

    if (error) setMessage("Google no esta configurado o no pudimos iniciar OAuth.");
  }

  async function recoverPassword() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !normalizedEmail) {
      setMessage("Ingresa tu email para enviar recuperacion.");
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: `${window.location.origin}/login`
    });
    setMessage(error ? "No pudimos enviar el email de recuperacion." : "Te enviamos instrucciones de recuperacion.");
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <span className="brand__mark brand__mark--logo auth-logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logoFZAC.jpg" alt="FZAC" />
        </span>
        <span className="kicker">{mode === "login" ? "Ingresar" : "Registro"}</span>
        <h1>{mode === "login" ? "Accede a tu cuenta FZAC" : "Crea tu cuenta FZAC"}</h1>
        <p>Supabase Auth protege email, contrasena y Google OAuth. El rol admin se valida en backend.</p>

        <button className="btn btn--ghost" type="button" onClick={googleLogin}>
          <LogIn size={18} />
          Continuar con Google
        </button>

        <form onSubmit={submit}>
          <input aria-hidden="true" className="auth-hp" tabIndex={-1} value={hp} onChange={(event) => setHp(event.target.value)} />
          {mode === "register" ? (
            <>
              <label className="field">
                Nombre y apellido
                <input value={name} onChange={(event) => setName(event.target.value)} required minLength={2} autoComplete="name" />
              </label>
              <label className="field">
                Telefono
                <input value={phone} onChange={(event) => setPhone(event.target.value)} required minLength={6} autoComplete="tel" />
              </label>
            </>
          ) : null}
          <label className="field">
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => {
                const next = event.target.value;
                setEmail(next);
                if (!next.includes("@")) setEmailExists(false);
              }}
              required
              autoComplete="email"
            />
          </label>
          {mode === "register" && checkingEmail ? <p className="auth-inline">Verificando email...</p> : null}
          {mode === "register" && emailExists ? (
            <p className="notice notice--danger">
              <MailWarning size={17} /> Ya existe una cuenta con ese email. Inicia sesion.
            </p>
          ) : null}
          <label className="field">
            Contrasena
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={mode === "register" ? 8 : 1}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </label>
          {mode === "register" ? (
            <>
              <div className="password-checklist" aria-label="Reglas de contrasena">
                {checks.map((check) => (
                  <span className={check.ok ? "is-ok" : ""} key={check.id}>
                    <CheckCircle size={15} /> {check.label}
                  </span>
                ))}
              </div>
              <label className="field">
                Confirmar contrasena
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </label>
              <label className="field auth-terms">
                <span>
                  <input type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} /> Acepto{" "}
                  <Link href="/terminos" target="_blank">
                    terminos
                  </Link>{" "}
                  y{" "}
                  <Link href="/privacidad" target="_blank">
                    privacidad
                  </Link>
                  .
                </span>
              </label>
            </>
          ) : null}
          <button className="btn" type="submit" disabled={loading || (mode === "register" && emailExists)}>
            {loading ? <Loader2 size={18} /> : null}
            {mode === "login" ? "Ingresar" : "Registrarme"}
          </button>
        </form>

        {mode === "login" ? (
          <button className="auth-link-button" type="button" onClick={recoverPassword}>
            Recuperar contrasena
          </button>
        ) : null}

        {message ? <p className={message.includes("enviamos") ? "notice notice--success" : "notice notice--danger"}>{message}</p> : null}

        <p>
          {mode === "login" ? (
            <>
              No tenes cuenta? <Link href="/registro">Registrate</Link>
            </>
          ) : (
            <>
              Ya tenes cuenta? <Link href="/login">Ingresar</Link>
            </>
          )}
        </p>
      </section>
    </main>
  );
}
