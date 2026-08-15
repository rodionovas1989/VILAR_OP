import { FormEvent, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { COOKIES_NOTICE_SHORT, PDN_POLICY_VERSION } from '../content/legal';
import LegalPolicyBody from './LegalPolicyBody';

/** Full-screen login only — no product or company branding for guests. */
export default function AuthGate() {
  const { login } = useAuth();
  const [loginName, setLoginName] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(loginName, password, rememberMe);
      setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-gate">
      <div className="auth-gate-panel">
        <h1 className="auth-gate-title">Вход</h1>
        <p className="auth-gate-hint">Введите учётные данные, выданные администратором.</p>
        <form className="auth-gate-form" onSubmit={onSubmit}>
          <label>
            Логин
            <input
              type="text"
              value={loginName}
              onChange={(e) => setLoginName(e.target.value)}
              autoComplete="username"
              autoFocus
              required
              disabled={busy}
            />
          </label>
          <label>
            Пароль
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              disabled={busy}
            />
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              disabled={busy}
            />
            Запомнить на этом компьютере
          </label>
          <p className="auth-gate-cookies">{COOKIES_NOTICE_SHORT}</p>
          <p className="auth-gate-legal-link">
            <button type="button" className="linkish" onClick={() => setPolicyOpen(true)}>
              Политика обработки персональных данных
            </button>
            <span className="muted"> (версия {PDN_POLICY_VERSION})</span>
          </p>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="auth-gate-submit" disabled={busy}>
            {busy ? 'Вход…' : 'Войти'}
          </button>
        </form>
      </div>
      {policyOpen && (
        <div className="legal-modal-backdrop" role="dialog" aria-modal="true">
          <div className="legal-modal">
            <div className="legal-modal-header">
              <h2>Политика обработки персональных данных</h2>
              <button type="button" className="ghost" onClick={() => setPolicyOpen(false)}>
                Закрыть
              </button>
            </div>
            <div className="legal-modal-body">
              <LegalPolicyBody />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
