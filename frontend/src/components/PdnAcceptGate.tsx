import { FormEvent, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import LegalPolicyBody from './LegalPolicyBody';
import { PDN_POLICY_VERSION } from '../content/legal';

export default function PdnAcceptGate() {
  const { user, setUserFromServer, logout } = useAuth();
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!accepted || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await api.acceptPdn(PDN_POLICY_VERSION);
      setUserFromServer(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pdn-accept-gate">
      <div className="pdn-accept-panel">
        <h1 className="auth-gate-title">Обработка персональных данных</h1>
        <p className="auth-gate-hint">
          Перед началом работы ознакомьтесь с Политикой (версия {PDN_POLICY_VERSION}) и подтвердите
          принятие. Учётная запись выдана администратором.
        </p>
        <div className="pdn-accept-scroll">
          <LegalPolicyBody />
        </div>
        <form className="pdn-accept-form" onSubmit={onSubmit}>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              disabled={busy}
            />
            Ознакомлен(а) с Политикой обработки персональных данных и принимаю её условия
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="pdn-accept-actions">
            <button type="button" className="ghost" onClick={() => logout()} disabled={busy}>
              Выйти
            </button>
            <button type="submit" className="auth-gate-submit" disabled={busy || !accepted}>
              {busy ? 'Сохранение…' : 'Принять и продолжить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
