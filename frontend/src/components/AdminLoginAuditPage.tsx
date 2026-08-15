import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { canViewObject } from '../auth/permissions';
import { useAuth } from '../auth/AuthContext';
import AccessDenied from './AccessDenied';
import PageTitle from './PageTitle';
import RefreshButton from './RefreshButton';

type AuditRow = {
  at: string;
  ok: boolean;
  login: string;
  userId?: string | null;
  ip?: string;
  reason?: string | null;
};

export default function AdminLoginAuditPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const canRead = canViewObject(user?.permissions, 'admin_login_audit');

  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const res = await api.listLoginAudit(300);
      setRows(res.items || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!canRead) return;
    load().catch(() => {});
  }, [canRead, load]);

  if (!canRead) {
    return <AccessDenied title="Журнал входов" />;
  }

  return (
    <div className="page">
      <div className="page-toolbar">
        <PageTitle pageId="admin_login_audit" title="Журнал входов" />
        <RefreshButton onClick={() => load()} disabled={busy} />
      </div>
      <p className="hint">
        Успешные и неуспешные попытки входа (логин, IP, время). Журнал хранится на сервере отдельно от
        очистки демо-данных. Срок хранения: 90 суток (более старые записи удаляются автоматически).
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Время</th>
              <th>Результат</th>
              <th>Логин</th>
              <th>IP</th>
              <th>Примечание</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  Пока нет записей
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={`${r.at}-${i}`}>
                <td>{r.at?.replace('T', ' ').replace(/\.\d+Z$/, ' UTC') || '—'}</td>
                <td>{r.ok ? 'Успех' : 'Отказ'}</td>
                <td>{r.login || '—'}</td>
                <td>{r.ip || '—'}</td>
                <td>{r.ok ? '—' : r.reason || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
