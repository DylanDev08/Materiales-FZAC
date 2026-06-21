import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FcGoogle } from 'react-icons/fc';
import { FiLock } from 'react-icons/fi';

import { useAuth } from '../../context/AuthContext';
import { getFriendlyApiError } from '../../api/apiClient';
import { isSupabaseAuthEnabled, signInWithGoogle } from '../../api/supabaseClient';

const hasSuspiciousContent = (value) => /(<script|javascript:|onerror=|onload=|\bselect\b|\binsert\b|\bupdate\b|\bdelete\b|\bdrop\b|\bunion\b|--|;|\/\*|\*\/)/i.test(String(value || ''));

export const Register = () => {
  const { register } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', website: '' });
  const [startedAt] = useState(Date.now());
  const [err, setErr] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const submit = async (event) => {
    event.preventDefault();
    setErr('');

    if (form.website) {
      setErr('No pudimos validar la solicitud. Intentá nuevamente.');
      return;
    }

    if (Date.now() - startedAt < 650) {
      setErr('Esperá un segundo y volvé a intentar.');
      return;
    }

    const payload = {
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim(),
      password: form.password,
      website: form.website,
      clientStartedAt: startedAt
    };

    if (!payload.name || payload.name.length < 2) {
      setErr('Ingresá tu nombre completo.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
      setErr('Ingresá un email válido.');
      return;
    }

    if (payload.password.length < 8) {
      setErr('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    if ([payload.name, payload.email, payload.phone].some(hasSuspiciousContent)) {
      setErr('Detectamos caracteres no permitidos en el formulario.');
      return;
    }

    setSubmitting(true);

    try {
      await register(payload);
      nav('/cuenta');
    } catch (error) {
      setErr(getFriendlyApiError(error));
    } finally {
      setSubmitting(false);
    }
  };

  const googleLogin = async () => {
    setErr('');

    if (!isSupabaseAuthEnabled) {
      setErr('Google todavía no está configurado para este entorno. Podés crear tu cuenta con email.');
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
        <h1>Crear cuenta</h1>
        <p className="auth-copy">Registrate para guardar tus datos de compra y consultar el estado de tus pedidos.</p>

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
          Registrarme con Google
        </button>

        {!isSupabaseAuthEnabled && <small className="auth-hint">Google se activa desde la configuración de Supabase. Mientras tanto, usá registro por email.</small>}

        <div className="auth-divider"><span>o creá una cuenta con email</span></div>

        <input value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="Nombre completo" autoComplete="name" required />
        <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="Email" autoComplete="email" required />
        <input value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="Teléfono" autoComplete="tel" />
        <input type="password" value={form.password} onChange={(e) => update('password', e.target.value)} placeholder="Contraseña" autoComplete="new-password" required />

        {err && <p className="error auth-error" role="alert">{err}</p>}

        <button className="btn auth-submit" disabled={submitting}>
          <FiLock />
          {submitting ? 'Creando cuenta...' : 'Crear cuenta'}
        </button>

        <p className="auth-bottom-text">¿Ya tenés cuenta? <Link to="/login">Ingresar</Link></p>
      </form>
    </main>
  );
};

export default Register;
