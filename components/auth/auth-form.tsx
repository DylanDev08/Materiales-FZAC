"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle, Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { normalizeEmail, passwordChecks } from "@/lib/validations/auth";

type AuthFieldErrors = Partial<Record<"name" | "phone" | "email" | "password" | "confirmPassword" | "acceptedTerms", string>>;

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const submitInFlightRef = useRef(false);
  const googleInFlightRef = useRef(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [hp, setHp] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [successLocked, setSuccessLocked] = useState(false);
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});

  const normalizedEmail = useMemo(() => normalizeEmail(email), [email]);
  const checks = useMemo(() => passwordChecks(password, normalizedEmail, name), [password, normalizedEmail, name]);
  const passwordOk = checks.every((check) => check.ok);
  const requestedNext = searchParams.get("next");
  const safeNext = requestedNext?.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/cuenta";

  function clearFieldError(field: keyof AuthFieldErrors) {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function validateClientForm() {
    const errors: AuthFieldErrors = {};
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      errors.email = "Ingresá un email válido.";
    }
    if (!password || password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password) || password !== password.trim()) {
      errors.password = "La contraseña debe tener al menos 8 caracteres, una letra y un número.";
    }

    if (mode === "register") {
      if (name.trim().length < 2) errors.name = "Completa tu nombre.";
      if (name.trim() && !/^[\p{L}\p{M}\s.'-]+$/u.test(name.trim())) errors.name = "Completa tu nombre con caracteres validos.";
      if (phone.trim() && !/^\+?[0-9\s().-]{6,40}$/.test(phone.trim())) errors.phone = "Ingresá un teléfono válido.";
      if (!passwordOk) errors.password = "La contraseña debe cumplir todas las reglas.";
      if (password !== confirmPassword) errors.confirmPassword = "Las contraseñas no coinciden.";
      if (!acceptedTerms) errors.acceptedTerms = "Aceptá términos y privacidad para crear la cuenta.";
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      setMessage("Revisá los campos marcados antes de continuar.");
      return false;
    }
    return true;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitInFlightRef.current || successLocked) return;
    if (!validateClientForm()) return;

    submitInFlightRef.current = true;
    setLoading(true);
    setMessage("");

    if (mode === "register") {
      if (!passwordOk || password !== confirmPassword || !acceptedTerms) {
        setMessage("Revisá contraseña, confirmación y términos antes de registrarte.");
        setLoading(false);
        submitInFlightRef.current = false;
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
      if (mode === "register") {
        setSuccessLocked(true);
        setMessage(data.message || "Cuenta creada correctamente. Revisá tu email para continuar.");
        window.setTimeout(() => router.push(data.target || "/login?registered=true"), 750);
        return;
      }
      router.push(data.target && data.target !== "/cuenta" ? data.target : safeNext);
    } catch (authError) {
      setMessage(authError instanceof Error ? authError.message : "No pudimos conectar con el servidor.");
    } finally {
      setLoading(false);
      submitInFlightRef.current = false;
    }
  }

  async function googleLogin() {
    if (googleInFlightRef.current) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setMessage("El ingreso con Google no esta disponible en este momento.");
      return;
    }

    googleInFlightRef.current = true;
    setGoogleLoading(true);
    setMessage("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext)}` }
    });

    if (error) {
      setMessage("No pudimos conectar con Google. Intentá nuevamente.");
      googleInFlightRef.current = false;
      setGoogleLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="auth-panel__head">
          <span className="brand__mark brand__mark--logo auth-logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logoFZAC.jpg" alt="FZAC" />
          </span>
          <div>
            <span className="kicker">{mode === "login" ? "Ingresar" : "Registro"}</span>
            <h1>{mode === "login" ? "Accedé a tu cuenta FZAC" : "Creá tu cuenta FZAC"}</h1>
            <p>Ingresá con email o Google. Tus datos se validan de forma segura y los permisos se controlan desde el servidor.</p>
          </div>
        </div>

        <button className="btn btn--ghost auth-google" type="button" onClick={googleLogin} disabled={loading || googleLoading || successLocked}>
          {googleLoading ? <Loader2 size={18} /> : <LogIn size={18} />}
          Continuar con Google
        </button>

        <div className="auth-divider">
          <span />
          <small>o ingresá con email</small>
          <span />
        </div>

        <form onSubmit={submit}>
          <input aria-hidden="true" className="auth-hp" tabIndex={-1} value={hp} onChange={(event) => setHp(event.target.value)} />
          {mode === "register" ? (
            <>
              <label className="field">
                Nombre y apellido
                <input
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    clearFieldError("name");
                  }}
                  required
                  minLength={2}
                  autoComplete="name"
                  aria-invalid={Boolean(fieldErrors.name)}
                />
                {fieldErrors.name ? <span className="auth-field-error">{fieldErrors.name}</span> : null}
              </label>
              <label className="field">
                Teléfono (opcional)
                <input
                  value={phone}
                  onChange={(event) => {
                    setPhone(event.target.value);
                    clearFieldError("phone");
                  }}
                  minLength={6}
                  autoComplete="tel"
                  aria-invalid={Boolean(fieldErrors.phone)}
                />
                {fieldErrors.phone ? <span className="auth-field-error">{fieldErrors.phone}</span> : null}
              </label>
            </>
          ) : null}
          <label className="field">
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                clearFieldError("email");
              }}
              required
              autoComplete="email"
              aria-invalid={Boolean(fieldErrors.email)}
            />
            {fieldErrors.email ? <span className="auth-field-error">{fieldErrors.email}</span> : null}
          </label>
          <label className="field">
            Contraseña
            <span className="auth-password-field">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  clearFieldError("password");
                }}
                required
                minLength={mode === "register" ? 8 : 1}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                aria-invalid={Boolean(fieldErrors.password)}
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
            {fieldErrors.password ? <span className="auth-field-error">{fieldErrors.password}</span> : null}
          </label>
          {mode === "register" ? (
            <>
              <div className="password-checklist" aria-label="Reglas de contraseña">
                {checks.map((check) => (
                  <span className={check.ok ? "is-ok" : ""} key={check.id}>
                    <CheckCircle size={15} /> {check.label}
                  </span>
                ))}
              </div>
              <label className="field">
                Confirmar contraseña
                <span className="auth-password-field">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(event) => {
                      setConfirmPassword(event.target.value);
                      clearFieldError("confirmPassword");
                    }}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    aria-invalid={Boolean(fieldErrors.confirmPassword)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((current) => !current)}
                    aria-label={showConfirmPassword ? "Ocultar confirmación" : "Mostrar confirmación"}
                    title={showConfirmPassword ? "Ocultar confirmación" : "Mostrar confirmación"}
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </span>
                {fieldErrors.confirmPassword ? <span className="auth-field-error">{fieldErrors.confirmPassword}</span> : null}
              </label>
              <label className="field auth-terms">
                <span>
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(event) => {
                      setAcceptedTerms(event.target.checked);
                      clearFieldError("acceptedTerms");
                    }}
                  /> Acepto{" "}
                  <Link href="/terminos" target="_blank">
                    términos
                  </Link>{" "}
                  y{" "}
                  <Link href="/privacidad" target="_blank">
                    privacidad
                  </Link>
                  .
                </span>
                {fieldErrors.acceptedTerms ? <span className="auth-field-error">{fieldErrors.acceptedTerms}</span> : null}
              </label>
            </>
          ) : null}
          <button className="btn" type="submit" disabled={loading || successLocked}>
            {loading ? <Loader2 size={18} /> : null}
            {loading ? "Validando..." : mode === "login" ? "Ingresar" : "Registrarme"}
          </button>
        </form>

        {mode === "login" ? (
          <Link className="auth-link-button" href="/recuperar">Recuperar contraseña</Link>
        ) : null}

        {message ? (
          <p className={message.includes("enviamos") || message.includes("Cuenta creada") ? "notice notice--success" : "notice notice--danger"}>
            {message}
          </p>
        ) : null}

        <p>
          {mode === "login" ? (
            <>
              ¿No tenés cuenta? <Link href="/registro">Registrate</Link>
            </>
          ) : (
            <>
              ¿Ya tenés cuenta? <Link href="/login">Ingresar</Link>
            </>
          )}
        </p>
      </section>
    </main>
  );
}
