import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FcGoogle } from 'react-icons/fc';
import { FiLock } from 'react-icons/fi';

import { useAuth } from '../../context/AuthContext';
import { getFriendlyApiError } from '../../api/apiClient';
import { isSupabaseAuthEnabled, signInWithGoogle } from '../../api/supabaseClient';

const MAX_LOCAL_ATTEMPTS = 10;
const LOCK_MS = 60 * 1000;

const getLoginGuard = () => {
  try {
    return JSON.parse(localStorage.getItem('fzac_login_guard') || '{}');
  } catch {
    return {};
  }
};

const setLoginGuard = (guard) => {
  localStorage.setItem('fzac_login_guard', JSON.stringify(guard));
};

const hasSuspiciousContent = (value) => {
  return /(<script|javascript:|onerror=|onload=|\bselect\b|\binsert\b|\bupdate\b|\bdelete\b|\bdrop\b|\bunion\b|--|;|\/\*|\*\/)/i.test(String(value || ''));
};

export const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '', website: '' });
  const [startedAt] = useState(Date.now());
  const [err, setErr] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const guard = useMemo(() => getLoginGuard(), [err]);
  const lockedUntil = Number(guard.lockedUntil || 0);
  const isLocallyLocked = lockedUntil > Date.now();

  const update = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const registerFailedAttempt = () => {
    const current = getLoginGuard();
    const attempts = Number(current.attempts || 0) + 1;

    if (attempts >= MAX_LOCAL_ATTEMPTS) {
      setLoginGuard({ attempts: 0, lockedUntil: Date.now() + LOCK_MS });
      return;
    }

    setLoginGuard({ ...current, attempts, lockedUntil: 0 });
  };

  const clearGuard = () => {
    localStorage.removeItem('fzac_login_guard');
  };

  const validateClientSide = ({ email, password }) => {
    if (form.website) {
      setErr('No pudimos validar el acceso. Intentá nuevamente.');
      return false;
    }

    if (Date.now() - startedAt < 650) {
      setErr('Esperá un segundo y volvé a intentar.');
      return false;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErr('Ingresá un email válido.');
      return false;
    }

    if (password.length < 8) {
      setErr('La contraseña debe tener al menos 8 caracteres.');
      return false;
    }

    if (hasSuspiciousContent(email)) {
      setErr('El email contiene caracteres no permitidos.');
      return false;
    }

    return true;
  };

  const submit = async (event) => {
    event.preventDefault();
    setErr('');

    if (isLocallyLocked) {
      setErr('Por seguridad, espera un minuto antes de volver a intentar.');
      return;
    }

    const email = form.email.trim().toLowerCase();
    const password = form.password;

    if (!validateClientSide({ email, password })) return;

    setSubmitting(true);

    try {
      await login({
        email,
        password,
        website: form.website,
        clientStartedAt: startedAt
      });

      clearGuard();
      navigate(location.state?.from || '/cuenta', { replace: true });
    } catch (error) {
      registerFailedAttempt();
      setErr(getFriendlyApiError(error));
    } finally {
      setSubmitting(false);
    }
  };

  const googleLogin = async () => {
    setErr('');

    if (!isSupabaseAuthEnabled) {
      setErr('Google todavía no está configurado para este entorno. Podés ingresar con email y contraseña.');
      return;
    }

    try {
      await signInWithGoogle();
    } catch (error) {
      setErr(error.message || 'No pudimos iniciar sesión con Google.');
    }
  };

  return (
    <main className="auth-page fzac-auth-page">
      <form className="auth-card fzac-auth-card auth-card--clean" onSubmit={submit} noValidate>
        <span className="kicker">Cliente FZAC</span>
        <h1>Ingresar</h1>
        <p className="auth-copy">
          Accedé a tu cuenta para consultar pedidos, guardar tus datos de compra y continuar operaciones de forma segura.
        </p>

        <input
          className="auth-honeypot"
          type="text"
          name="website"
          value={form.website}
          onChange={(event) => update('website', event.target.value)}
          tabIndex="-1"
          autoComplete="off"
          aria-hidden="true"
        />

        <button className="oauth-btn" type="button" onClick={googleLogin}>
          <FcGoogle />
          Continuar con Google
        </button>

        {!isSupabaseAuthEnabled && (
          <small className="auth-hint">Google se activa desde la configuración de Supabase. Mientras tanto, usá acceso por email.</small>
        )}

        <div className="auth-divider"><span>o ingresá con email</span></div>

        <input
          type="email"
          value={form.email}
          onChange={(event) => update('email', event.target.value)}
          placeholder="Email"
          autoComplete="email"
          required
        />

        <input
          type="password"
          value={form.password}
          onChange={(event) => update('password', event.target.value)}
          placeholder="Contraseña"
          autoComplete="current-password"
          required
        />

        {err && <p className="error auth-error" role="alert">{err}</p>}

        <button className="btn auth-submit" disabled={submitting || isLocallyLocked}>
          <FiLock />
          {submitting ? 'Ingresando...' : 'Ingresar'}
        </button>

        <p className="auth-bottom-text">¿No tenés cuenta? <Link to="/registro">Crear cuenta</Link></p>
      </form>
    </main>
  );
};

export default Login;
