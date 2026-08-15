import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { PermissionMap } from '../constants/systemObjects';
import { api, setAuthToken } from '../api';
import { PDN_POLICY_VERSION } from '../content/legal';

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
  pdnAcceptedAt?: string | null;
  pdnPolicyVersion?: string | null;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  loginOpen: boolean;
  needsPdnAccept: boolean;
  openLogin: () => void;
  closeLogin: () => void;
  login: (login: string, password: string, rememberMe: boolean) => Promise<void>;
  logout: () => void;
  setUserFromServer: (user: AuthUser) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function clearLegacyTokenStorage() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REMEMBER_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
}

export function userNeedsPdnAccept(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  return user.pdnPolicyVersion !== PDN_POLICY_VERSION || !user.pdnAcceptedAt;
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

  const setUserFromServer = useCallback((next: AuthUser) => {
    setUser(next);
  }, []);

  const login = useCallback(async (loginName: string, password: string, rememberMe: boolean) => {
    const res = await api.authLogin(loginName, password, rememberMe);
    clearLegacyTokenStorage();
    setAuthToken(null);
    setUser(res.user);
    setLoginOpen(false);
  }, []);

  useEffect(() => {
    clearLegacyTokenStorage();
    setAuthToken(null);
    api
      .authMe()
      .then((u) => setUser(u))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const needsPdnAccept = userNeedsPdnAccept(user);

  const value = useMemo(
    () => ({
      user,
      loading,
      loginOpen,
      needsPdnAccept,
      openLogin: () => setLoginOpen(true),
      closeLogin: () => setLoginOpen(false),
      login,
      logout,
      setUserFromServer,
    }),
    [user, loading, loginOpen, needsPdnAccept, login, logout, setUserFromServer]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth вне AuthProvider');
  return ctx;
}
