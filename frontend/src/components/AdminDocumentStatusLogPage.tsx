import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { canViewObject } from '../auth/permissions';
import { useAuth } from '../auth/AuthContext';
import AccessDenied from './AccessDenied';
import PageTitle from './PageTitle';
import RefreshButton from './RefreshButton';

type LogRow = {
  id?: string;
  at: string;
  action: string;
  documentType: string;
  documentId: string;
  documentNumber?: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  userId?: string | null;
  productionOrderId?: string | null;
};

const ACTION_LABEL: Record<string, string> = {
  create: 'Создание',
  save: 'Сохранение',
  post: 'Проведение',
  cancel: 'Отмена',
  repost: 'Перепроведение',
  fulfill: 'Выполнение',
};

export default function AdminDocumentStatusLogPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<LogRow[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [documentType, setDocumentType] = useState('');

  const canRead = canViewObject(user?.permissions, 'admin_document_status_log');

  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const res = await api.listDocumentStatusLog(300, {
        documentType: documentType || undefined,
      });
      setRows(res.items || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [documentType]);

  useEffect(() => {
    if (!canRead) return;
    load().catch(() => {});
  }, [canRead, load]);

  if (!canRead) {
    return <AccessDenied title="Изменение статусов документов" />;
  }

  return (
    <div className="page">
      <div className="page-toolbar">
        <PageTitle pageId="admin_document_status_log" title="Изменение статусов документов" />
        <RefreshButton onClick={() => load()} disabled={busy} />
      </div>
      <p className="hint">
        Журнал переходов статусов складских документов: создание, сохранение черновика, проведение,
        отмена, перепроведение, выполнение резерва. Записи хранятся в базе и попадают в резервные копии.
      </p>
      <div className="toolbar" style={{ marginBottom: 12 }}>
        <label>
          Тип документа
          <input
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value.trim())}
            placeholder="например: receipt"
            disabled={busy}
          />
        </label>
        <button type="button" className="ghost" onClick={() => load()} disabled={busy}>
          Применить
        </button>
      </div>
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
              <th>Действие</th>
              <th>Тип</th>
              <th>Номер</th>
              <th>Статус</th>
              <th>Пользователь</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  Пока нет записей
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id || `${r.at}-${r.documentId}-${r.action}`}>
                <td>{r.at?.replace('T', ' ').replace(/\.\d+Z$/, ' UTC') || '—'}</td>
                <td>{ACTION_LABEL[r.action] || r.action}</td>
                <td>{r.documentType || '—'}</td>
                <td>{r.documentNumber || r.documentId?.slice(0, 8) || '—'}</td>
                <td>
                  {r.fromStatus || '—'} → {r.toStatus || '—'}
                </td>
                <td>{r.userId ? String(r.userId).slice(0, 8) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
