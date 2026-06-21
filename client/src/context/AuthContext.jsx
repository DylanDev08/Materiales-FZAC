import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '../api/authApi';

const AuthContext = createContext(null);
const getStoredUser = () => { try { return JSON.parse(localStorage.getItem('fzac_user') || 'null'); } catch { return null; } };

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(getStoredUser);
  const [isCheckingAuth, setIsCheckingAuth] = useState(false);

  useEffect(() => {
    setIsCheckingAuth(true);
    authApi.refresh().then((session) => {
      if (session?.user) {
        setUser(session.user);
        localStorage.setItem('fzac_user', JSON.stringify(session.user));
      }
    }).catch(() => {
      localStorage.removeItem('fzac_user');
      setUser(null);
    }).finally(() => setIsCheckingAuth(false));
  }, []);

  const login = async (payload) => { const data = await authApi.login(payload); setUser(data.user); return data; };
  const register = async (payload) => { const data = await authApi.register(payload); setUser(data.user); return data; };
  const refreshUser = async (nextUser) => { const currentUser = nextUser || await authApi.me(); setUser(currentUser); localStorage.setItem('fzac_user', JSON.stringify(currentUser)); return currentUser; };
  const logout = async () => { await authApi.logout(); setUser(null); };

  const value = useMemo(() => ({ user, isAuthenticated: !!user, isAdmin: user?.role === 'ADMIN', isCheckingAuth, login, register, logout, refreshUser }), [user, isCheckingAuth]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => { const ctx = useContext(AuthContext); if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider'); return ctx; };
