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

function readStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginOpen, setLoginOpen] = useState(false);

  const applyToken = useCallback((token: string | null) => {
    setAuthToken(token);
    if (!token) {
      setUser(null);
      return;
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REMEMBER_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    applyToken(null);
    api.authLogout().catch(() => {});
  }, [applyToken]);

  const login = useCallback(
    async (loginName: string, password: string, rememberMe: boolean) => {
      const res = await api.authLogin(loginName, password, rememberMe);
      localStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(TOKEN_KEY);
      if (rememberMe) {
        localStorage.setItem(TOKEN_KEY, res.token);
        localStorage.setItem(REMEMBER_KEY, '1');
      } else {
        sessionStorage.setItem(TOKEN_KEY, res.token);
        localStorage.removeItem(REMEMBER_KEY);
      }
      applyToken(res.token);
      setUser(res.user);
      setLoginOpen(false);
    },
    [applyToken]
  );

  useEffect(() => {
    const token = readStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }
    applyToken(token);
    api
      .authMe()
      .then((u) => setUser(u))
      .catch(() => logout())
      .finally(() => setLoading(false));
  }, [applyToken, logout]);

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
