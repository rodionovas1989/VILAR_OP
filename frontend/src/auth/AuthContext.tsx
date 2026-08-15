import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { PermissionMap } from '../constants/systemObjects';
import { api, setAuthToken } from '../api';

const TOKEN_KEY = 'vilar_auth_token';
const REMEMBER_KEY = 'vilar_auth_remember';

export type AuthUser = {
  id: string;
  name: string;
  login: string;
  role?: string | null;
  roleId?: string | null;
  roleName?: string | null;
  permissions?: PermissionMap;
  active?: boolean;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  loginOpen: boolean;
  openLogin: () => void;
  closeLogin: () => void;
  login: (login: string, password: string, rememberMe: boolean) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function clearLegacyTokenStorage() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REMEMBER_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginOpen, setLoginOpen] = useState(false);

  const logout = useCallback(() => {
    clearLegacyTokenStorage();
    setAuthToken(null);
    setUser(null);
    api.authLogout().catch(() => {});
  }, []);

  const login = useCallback(async (loginName: string, password: string, rememberMe: boolean) => {
    const res = await api.authLogin(loginName, password, rememberMe);
    clearLegacyTokenStorage();
    // Сессия в httpOnly cookie; Bearer из storage больше не используем
    setAuthToken(null);
    setUser(res.user);
    setLoginOpen(false);
  }, []);

  useEffect(() => {
    // Очистить старые токены из storage (миграция с Bearer-only)
    clearLegacyTokenStorage();
    setAuthToken(null);
    api
      .authMe()
      .then((u) => setUser(u))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      loginOpen,
      openLogin: () => setLoginOpen(true),
      closeLogin: () => setLoginOpen(false),
      login,
      logout,
    }),
    [user, loading, loginOpen, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth вне AuthProvider');
  return ctx;
}
