import { FormEvent, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Modal } from './Modal';

export default function LoginModal() {
  const { loginOpen, closeLogin, login } = useAuth();
  const [loginName, setLoginName] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

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
    <Modal
      open={loginOpen}
      title="Вход в систему"
      onClose={closeLogin}
      footer={
        <>
          <button type="button" className="ghost" onClick={closeLogin} disabled={busy}>
            Отмена
          </button>
          <button type="submit" form="login-form" disabled={busy}>
            Войти
          </button>
        </>
      }
    >
      <form id="login-form" onSubmit={onSubmit} className="form-grid">
        <label>
          Логин
          <input value={loginName} onChange={(e) => setLoginName(e.target.value)} autoComplete="username" required />
        </label>
        <label>
          Пароль
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        <label className="checkbox-row full-width">
          <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
          Запомнить на этом компьютере
        </label>
        {error && (
          <p className="error full-width" role="alert">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
