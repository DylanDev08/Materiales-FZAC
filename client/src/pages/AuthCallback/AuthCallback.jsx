import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../api/supabaseClient';
import { authApi } from '../../api/authApi';
import { useAuth } from '../../context/AuthContext';

export const AuthCallback = () => {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [message, setMessage] = useState('Validando sesión con Google...');

  useEffect(() => {
    const sync = async () => {
      try {
        if (!supabase) {
          throw new Error('Supabase Auth no está configurado.');
        }

        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }

        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        const session = data?.session;

        if (!session?.access_token) {
          throw new Error('No pudimos obtener una sesión válida de Google.');
        }

        const result = await authApi.oauthSupabase({
          accessToken: session.access_token
        });

        await refreshUser(result.user);
        navigate('/cuenta', { replace: true });
      } catch (error) {
        setMessage(error.message || 'No pudimos iniciar sesión con Google.');
      }
    };

    sync();
  }, [navigate, refreshUser]);

  return (
    <main className="auth-page">
      <section className="auth-card auth-card--center">
        <span className="kicker">Google Auth</span>
        <h1>Conectando cuenta</h1>
        <p>{message}</p>
        <Link className="btn secondary" to="/login">Volver al login</Link>
      </section>
    </main>
  );
};
