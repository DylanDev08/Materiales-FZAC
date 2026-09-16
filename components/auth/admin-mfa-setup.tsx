"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type TotpEnrollment = {
  factorId: string;
  qrCode: string;
  secret: string;
};

type MfaMode = "loading" | "enroll" | "challenge" | "ready" | "error";

function friendlyError(message: string) {
  if (/invalid.*code|code.*invalid|expired/i.test(message)) return "El codigo es incorrecto o vencio. Genera uno nuevo e intenta otra vez.";
  if (/factor.*exist|already.*exist/i.test(message)) return "Ese factor ya existe. Actualiza la pantalla para usarlo.";
  return "No pudimos completar la verificacion. Intenta nuevamente sin cerrar tu sesion.";
}

export function AdminMfaSetup({ adminPath }: { adminPath: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<MfaMode>("loading");
  const [verifiedFactorId, setVerifiedFactorId] = useState("");
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [factorCount, setFactorCount] = useState(0);

  const loadStatus = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setMode("error");
      setMessage("La autenticacion segura no esta disponible en este momento.");
      return;
    }

    const [assurance, factors] = await Promise.all([
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      supabase.auth.mfa.listFactors()
    ]);
    if (assurance.error || factors.error) {
      setMode("error");
      setMessage("No pudimos consultar el estado de seguridad de la cuenta.");
      return;
    }

    const verified = factors.data.totp.filter((factor) => factor.status === "verified");
    setFactorCount(verified.length);
    if (assurance.data.currentLevel === "aal2") {
      setMode("ready");
      return;
    }
    if (verified[0]) {
      setVerifiedFactorId(verified[0].id);
      setMode("challenge");
      return;
    }
    setMode("enroll");
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadStatus(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadStatus]);

  async function beginEnrollment() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const factors = await supabase.auth.mfa.listFactors();
      if (factors.error) throw factors.error;
      const stale = factors.data.all.filter((factor) => factor.factor_type === "totp" && factor.status === "unverified");
      for (const factor of stale) {
        const removal = await supabase.auth.mfa.unenroll({ factorId: factor.id });
        if (removal.error) throw removal.error;
      }

      const result = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: factorCount ? `FZAC respaldo ${factorCount + 1}` : "FZAC administrador",
        issuer: "Materiales FZAC"
      });
      if (result.error || result.data.type !== "totp") throw result.error ?? new Error("TOTP_NOT_AVAILABLE");
      setEnrollment({
        factorId: result.data.id,
        qrCode: result.data.totp.qr_code,
        secret: result.data.totp.secret
      });
      setCode("");
    } catch (error) {
      setMessage(friendlyError(error instanceof Error ? error.message : ""));
    } finally {
      setBusy(false);
    }
  }

  async function verify(factorId: string) {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || busy || !/^\d{6,10}$/.test(code)) {
      setMessage("Ingresa el codigo numerico de tu aplicacion autenticadora.");
      return;
    }
    setBusy(true);
    setMessage("");
    const result = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    setBusy(false);
    if (result.error) {
      setMessage(friendlyError(result.error.message));
      return;
    }
    router.replace(adminPath);
    router.refresh();
  }

  const activeFactorId = enrollment?.factorId || verifiedFactorId;

  return (
    <main className="auth-page admin-mfa-page">
      <section className="auth-panel admin-mfa-card" aria-live="polite">
        <div className="auth-panel__head">
          <span className="admin-mfa-icon"><ShieldCheck size={28} /></span>
          <div>
            <span className="kicker">Seguridad administrativa</span>
            <h1>Verificacion en dos pasos</h1>
            <p>El panel requiere un codigo TOTP ademas de tu sesion. Esta proteccion no se aplica a clientes.</p>
          </div>
        </div>

        {mode === "loading" ? <p className="admin-mfa-status"><Loader2 className="spin" size={20} /> Verificando tu sesion...</p> : null}

        {mode === "enroll" && !enrollment ? (
          <div className="admin-mfa-stack">
            <p>Configura Google Authenticator, Microsoft Authenticator, Authy o un gestor compatible.</p>
            <button className="btn" type="button" onClick={beginEnrollment} disabled={busy}>
              {busy ? <Loader2 className="spin" size={18} /> : <KeyRound size={18} />}
              Generar codigo QR
            </button>
          </div>
        ) : null}

        {enrollment ? (
          <div className="admin-mfa-stack">
            {/* El SVG es generado por Supabase Auth para esta sesion; nunca se persiste ni registra. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="admin-mfa-qr" src={enrollment.qrCode} alt="Codigo QR para configurar TOTP" />
            <p>Escanea el QR. Si no podes, ingresa esta clave manualmente:</p>
            <code className="admin-mfa-secret">{enrollment.secret}</code>
          </div>
        ) : null}

        {mode === "challenge" || enrollment ? (
          <form
            className="admin-mfa-stack"
            onSubmit={(event) => {
              event.preventDefault();
              void verify(activeFactorId);
            }}
          >
            <label className="field">
              Codigo de la aplicacion
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6,10}"
                minLength={6}
                maxLength={10}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 10))}
                required
                autoFocus
              />
            </label>
            <button className="btn" type="submit" disabled={busy || !activeFactorId}>
              {busy ? <Loader2 className="spin" size={18} /> : <ShieldCheck size={18} />}
              Verificar y entrar
            </button>
          </form>
        ) : null}

        {mode === "ready" ? (
          <div className="admin-mfa-stack">
            <p className="notice notice--success"><CheckCircle2 size={18} /> Sesion verificada con AAL2.</p>
            <button className="btn" type="button" onClick={() => router.replace(adminPath)}>Entrar al panel</button>
            <button className="btn btn--ghost" type="button" onClick={beginEnrollment} disabled={busy}>
              Agregar dispositivo de respaldo
            </button>
            <small>Conserva un segundo factor en otro dispositivo. La recuperacion por perdida total se realiza desde Supabase por el propietario, no por email ni por soporte publico.</small>
          </div>
        ) : null}

        {message ? <p className="notice notice--danger">{message}</p> : null}
      </section>
    </main>
  );
}
