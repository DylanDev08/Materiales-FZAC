"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { CheckCircle2, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Mode = "loading" | "enroll" | "challenge" | "ready" | "error";

export function AdminMfaGate({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const started = useRef(false);
  const [mode, setMode] = useState<Mode>("loading");
  const [factorId, setFactorId] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("Verificando la seguridad de tu sesión.");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    void (async () => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        setMode("error");
        setMessage("La autenticación segura no está disponible en este momento.");
        return;
      }

      const aal = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (!aal.error && aal.data.currentLevel === "aal2") {
        setMode("ready");
        router.replace(nextPath);
        router.refresh();
        return;
      }

      const factors = await supabase.auth.mfa.listFactors();
      if (factors.error) {
        setMode("error");
        setMessage("No pudimos verificar tus factores de seguridad.");
        return;
      }

      const verified = factors.data.totp.find((factor) => factor.status === "verified");
      if (verified) {
        const challenge = await supabase.auth.mfa.challenge({ factorId: verified.id });
        if (challenge.error) {
          setMode("error");
          setMessage("No pudimos iniciar la verificación en dos pasos.");
          return;
        }

        setFactorId(verified.id);
        setChallengeId(challenge.data.id);
        setMode("challenge");
        setMessage("Ingresá el código actual de tu aplicación autenticadora.");
        return;
      }

      for (const factor of factors.data.totp.filter((item) => item.status !== "verified")) {
        await supabase.auth.mfa.unenroll({ factorId: factor.id }).catch(() => undefined);
      }

      const enrollment = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "FZAC Admin"
      });

      if (enrollment.error) {
        setMode("error");
        setMessage("No pudimos preparar el segundo factor. Volvé a iniciar sesión e intentá nuevamente.");
        return;
      }

      setFactorId(enrollment.data.id);
      setQrCode(enrollment.data.totp.qr_code);
      setSecret(enrollment.data.totp.secret);
      setMode("enroll");
      setMessage("Escaneá el QR con Google Authenticator, Microsoft Authenticator, 1Password o una app TOTP compatible.");
    })();
  }, [nextPath, router]);

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !factorId || !/^\d{6,8}$/.test(code.trim())) return;

    setBusy(true);
    setMessage("");
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setMode("error");
      setMessage("La autenticación segura no está disponible.");
      setBusy(false);
      return;
    }

    try {
      let activeChallenge = challengeId;
      if (!activeChallenge) {
        const challenge = await supabase.auth.mfa.challenge({ factorId });
        if (challenge.error) throw challenge.error;
        activeChallenge = challenge.data.id;
        setChallengeId(activeChallenge);
      }

      const result = await supabase.auth.mfa.verify({
        factorId,
        challengeId: activeChallenge,
        code: code.trim()
      });

      if (result.error) {
        setMessage("El código no es válido o venció. Esperá el próximo código e intentá otra vez.");
        return;
      }

      const aal = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal.error || aal.data.currentLevel !== "aal2") {
        setMessage("El segundo factor se verificó, pero la sesión todavía no alcanzó AAL2. Reintentá.");
        return;
      }

      setMode("ready");
      setMessage("Segundo factor verificado. Entrando al panel…");
      router.replace(nextPath);
      router.refresh();
    } catch {
      setMessage("No pudimos completar la verificación. Intentá nuevamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-panel admin-mfa-panel">
        <div className="auth-panel__head">
          <span className="brand__mark brand__mark--logo auth-logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logoFZAC.jpg" alt="FZAC" />
          </span>
          <div>
            <span className="kicker">Seguridad administrativa</span>
            <h1>Verificación en dos pasos</h1>
            <p>El panel FZAC requiere contraseña o Google + un código TOTP para cada sesión administrativa.</p>
          </div>
        </div>

        <div className="auth-trust-line">
          <span><ShieldCheck size={16} /> MFA obligatorio</span>
          <span><KeyRound size={16} /> Sesión AAL2</span>
        </div>

        {mode === "loading" ? (
          <div className="admin-mfa-state"><Loader2 className="spin" size={24} /><span>{message}</span></div>
        ) : null}

        {mode === "enroll" ? (
          <div className="admin-mfa-enroll">
            <p className="notice notice--info">{message}</p>
            {qrCode ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="admin-mfa-qr" src={qrCode} alt="Código QR para configurar MFA TOTP" />
            ) : null}
            {secret ? (
              <div className="admin-mfa-secret">
                <span>Clave manual</span>
                <code>{secret}</code>
              </div>
            ) : null}
          </div>
        ) : null}

        {mode === "challenge" ? <p className="notice notice--info">{message}</p> : null}

        {(mode === "enroll" || mode === "challenge") ? (
          <form onSubmit={verify} className="admin-mfa-form">
            <label className="field">
              Código de autenticación
              <input
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 8))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                minLength={6}
                maxLength={8}
                required
              />
            </label>
            <button className="btn" type="submit" disabled={busy || code.length < 6}>
              {busy ? <Loader2 size={18} className="spin" /> : <CheckCircle2 size={18} />}
              {busy ? "Verificando…" : mode === "enroll" ? "Activar MFA y entrar" : "Verificar y entrar"}
            </button>
          </form>
        ) : null}

        {mode === "error" ? <p className="notice notice--danger">{message}</p> : null}
        {mode === "ready" ? <p className="notice notice--success">{message}</p> : null}

        <p className="admin-mfa-help">
          Guardá el acceso a tu autenticador. Si perdés el dispositivo, la recuperación del acceso admin debe hacerse desde Supabase por un administrador autorizado.
        </p>
      </section>
    </main>
  );
}
