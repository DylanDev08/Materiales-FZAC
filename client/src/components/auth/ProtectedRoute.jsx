import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export const ProtectedRoute = ({ children, adminOnly = false }) => {
  const location = useLocation();
  const { user, isLoading, isCheckingAuth, isAuthenticated } = useAuth();

  if (isLoading || isCheckingAuth) {
    return (
      <main className="page auth-loading-page">
        <section className="auth-loading-card">
          <span className="kicker kicker--gold">FZAC</span>
          <h1>Cargando sesión...</h1>
          <p>Estamos verificando tu acceso.</p>
        </section>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: location.pathname
        }}
      />
    );
  }

  const role = user?.role;

  const isAdmin =
    role === 'ADMIN' ||
    role === 'SUPER_ADMIN' ||
    role === 'OPERATOR';

  if (adminOnly && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
};