import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { canViewObject } from '../auth/permissions';
import { useAuth } from '../auth/AuthContext';
import AccessDenied from './AccessDenied';
import PageTitle from './PageTitle';
import RefreshButton from './RefreshButton';

type OpsRow = {
  at: string;
  requestId?: string | null;
  level?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  durationMs?: number;
  userId?: string | null;
  error?: string | null;
  refs?: Record<string, string> | null;
};

export default function AdminOpsDebugLogPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<OpsRow[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const canRead = canViewObject(user?.permissions, 'admin_ops_debug_log');

  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const res = await api.listOpsDebugLog(300);
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
    return <AccessDenied title="Операционный журнал" />;
  }

  return (
    <div className="page">
      <div className="page-toolbar">
        <PageTitle pageId="admin_ops_debug_log" title="Операционный журнал (отладка)" />
        <RefreshButton onClick={() => load()} disabled={busy} />
      </div>
      <p className="hint">
        Журнал мутаций API и отказов (4xx/5xx) для поиска ошибок. Без паролей и тел login. Файл
        ops_debug.jsonl рядом с базой, срок хранения 90 дней. Не путать с журналом статусов документов.
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
              <th>Ур.</th>
              <th>Метод</th>
              <th>Путь</th>
              <th>Код</th>
              <th>мс</th>
              <th>Ошибка / refs</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="muted">
                  Пока нет записей
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={`${r.requestId || r.at}-${i}`}>
                <td>{r.at?.replace('T', ' ').replace(/\.\d+Z$/, ' UTC') || '—'}</td>
                <td>{r.level || '—'}</td>
                <td>{r.method || '—'}</td>
                <td className="mono">{r.path || '—'}</td>
                <td>{r.statusCode ?? '—'}</td>
                <td>{r.durationMs ?? '—'}</td>
                <td>
                  {r.error || '—'}
                  {r.refs ? (
                    <div className="muted" style={{ fontSize: 11 }}>
                      {JSON.stringify(r.refs)}
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
