"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { LogIn } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setMessage("Supabase no esta configurado. Carga las variables de entorno para usar auth.");
      setLoading(false);
      return;
    }

    const result =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: name }, emailRedirectTo: `${window.location.origin}/auth/callback` }
          });

    if (result.error) {
      setMessage(result.error.message);
      setLoading(false);
      return;
    }

    window.location.assign(mode === "login" ? "/cuenta" : "/login?registered=true");
  }

  async function googleLogin() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setMessage("Supabase no esta configurado.");
      return;
    }

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` }
    });
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <span className="kicker">{mode === "login" ? "Ingresar" : "Registro"}</span>
        <h1>{mode === "login" ? "Accede a tu cuenta FZAC" : "Crea tu cuenta"}</h1>
        <p>
          Usamos Supabase Auth con email y Google OAuth. El rol admin se valida en backend por email autorizado y perfil.
        </p>

        <button className="btn btn--ghost" type="button" onClick={googleLogin}>
          <LogIn size={18} />
          Continuar con Google
        </button>

        <form onSubmit={submit}>
          {mode === "register" ? (
            <label className="field">
              Nombre y apellido
              <input value={name} onChange={(event) => setName(event.target.value)} required />
            </label>
          ) : null}
          <label className="field">
            Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label className="field">
            Contrasena
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} />
          </label>
          <button className="btn" type="submit" disabled={loading}>
            {mode === "login" ? "Ingresar" : "Registrarme"}
          </button>
        </form>

        {message ? <p className="notice notice--danger">{message}</p> : null}

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
