import { useAuth } from '../auth/AuthContext';

export default function AppHeader() {
  const { user, loading, openLogin, logout } = useAuth();

  return (
    <header className="app-header">
      <div className="app-header-brand">
        <img src="/vilar-logo.png" alt="Фармцентр ВИЛАР" className="app-header-logo" />
        <div className="app-header-title">
          <span className="app-header-title-main">Вилар</span>
          <span className="app-header-title-sub">Оперативное планирование</span>
        </div>
      </div>
      <div className="app-header-user">
        {loading ? (
          <span className="app-header-muted">…</span>
        ) : user ? (
          <>
            <span className="app-header-name" title={user.login}>
              {user.name}
            </span>
            <button type="button" className="app-header-btn" onClick={logout}>
              Выйти
            </button>
          </>
        ) : (
          <>
            <span className="app-header-muted">Не авторизован</span>
            <button type="button" className="app-header-btn app-header-btn-primary" onClick={openLogin}>
              Войти
            </button>
          </>
        )}
      </div>
    </header>
  );
}
