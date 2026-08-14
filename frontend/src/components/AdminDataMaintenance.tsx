import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { canCreateObject, canModifyObject, canViewObject } from '../auth/permissions';
import { useAuth } from '../auth/AuthContext';
import AccessDenied from './AccessDenied';
import PageTitle from './PageTitle';

type BackupRow = {
  id: string;
  createdAt: string;
  label: string;
  reason: string;
  sizeBytes: number;
  counts?: { materials?: number; lots?: number; production_orders?: number; users?: number } | null;
};

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AdminDataMaintenance() {
  const { user } = useAuth();
  const [backups, setBackups] = useState<BackupRow[]>([]);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [clearConfirm, setClearConfirm] = useState('');
  const [demoConfirm, setDemoConfirm] = useState('');
  const [restoreId, setRestoreId] = useState<string | null>(null);
  const [restoreConfirm, setRestoreConfirm] = useState('');

  const canRead = canViewObject(user?.permissions, 'admin_data_maintenance');
  const canWrite = canModifyObject(user?.permissions, 'admin_data_maintenance');
  const canCreate = canCreateObject(user?.permissions, 'admin_data_maintenance');

  const reload = useCallback(async () => {
    const list = await api.listBackups();
    setBackups(list);
  }, []);

  useEffect(() => {
    if (!canRead) return;
    reload().catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [canRead, reload]);

  const run = async (fn: () => Promise<unknown>, okMsg: string) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await fn();
      setMessage(okMsg);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onCreateBackup = (e: FormEvent) => {
    e.preventDefault();
    void run(() => api.createBackup(label.trim() || undefined), 'Слепок базы создан');
    setLabel('');
  };

  if (!canRead) {
    return <AccessDenied title="Данные и резервные копии" />;
  }

  return (
    <div className="page admin-data-maintenance">
      <div className="page-toolbar">
        <PageTitle pageId="admin_data_maintenance" title="Данные и резервные копии" />
      </div>

      <p className="hint">
        Опасные операции доступны только администратору. Перед очисткой, демо и восстановлением сервер сам
        сохраняет слепок текущей базы в пул архивов.
      </p>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && <p className="ok-msg">{message}</p>}

      <section className="admin-panel">
        <h3>Резервные копии</h3>
        {(canCreate || canWrite) && (
          <form className="form-grid inline-form" onSubmit={onCreateBackup}>
            <label>
              Подпись слепка
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="например: до правок заказчика"
                disabled={busy}
              />
            </label>
            <button type="submit" disabled={busy || !canCreate}>
              {busy ? '…' : 'Создать слепок'}
            </button>
          </form>
        )}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Когда</th>
                <th>Подпись</th>
                <th>Причина</th>
                <th>Содержимое</th>
                <th>Размер</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {!backups.length && (
                <tr>
                  <td colSpan={6}>Архивов пока нет</td>
                </tr>
              )}
              {backups.map((b) => (
                <tr key={b.id}>
                  <td>{new Date(b.createdAt).toLocaleString('ru-RU')}</td>
                  <td>{b.label}</td>
                  <td>{b.reason}</td>
                  <td>
                    {b.counts
                      ? `мат. ${b.counts.materials ?? '—'}, парт. ${b.counts.lots ?? '—'}, зак. ${b.counts.production_orders ?? '—'}`
                      : '—'}
                    {b.counts && (b.counts.materials ?? 0) === 0 && (b.counts.lots ?? 0) === 0 ? (
                      <span className="error"> (пусто)</span>
                    ) : null}
                  </td>
                  <td>{formatBytes(b.sizeBytes)}</td>
                  <td className="row-actions">
                    {canWrite && (
                      <>
                        <button
                          type="button"
                          className="ghost"
                          disabled={busy}
                          onClick={() => {
                            const empty =
                              b.counts && (b.counts.materials ?? 0) === 0 && (b.counts.lots ?? 0) === 0;
                            if (empty) {
                              const ok = window.confirm(
                                'Этот архив выглядит пустым (0 материалов). Всё равно восстановить?'
                              );
                              if (!ok) return;
                            }
                            setRestoreId(b.id);
                            setRestoreConfirm('');
                            setError('');
                            setMessage('');
                          }}
                        >
                          Восстановить
                        </button>
                        <button
                          type="button"
                          className="ghost"
                          disabled={busy}
                          onClick={() => {
                            if (!window.confirm(`Удалить архив ${b.label}?`)) return;
                            void run(() => api.deleteBackup(b.id), 'Архив удалён');
                          }}
                        >
                          Удалить
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {restoreId && canWrite && (
          <div className="confirm-box">
            <p>
              Восстановление заменит текущую базу архивом <strong>{restoreId}</strong>. Введите{' '}
              <code>RESTORE</code>:
            </p>
            <input
              value={restoreConfirm}
              onChange={(e) => setRestoreConfirm(e.target.value)}
              disabled={busy}
              autoComplete="off"
            />
            <div className="toolbar-actions">
              <button type="button" className="ghost" disabled={busy} onClick={() => setRestoreId(null)}>
                Отмена
              </button>
              <button
                type="button"
                disabled={busy || restoreConfirm !== 'RESTORE'}
                onClick={() => {
                  void run(async () => {
                    await api.restoreBackup(restoreId, 'RESTORE');
                    setRestoreId(null);
                    setRestoreConfirm('');
                    window.alert('База восстановлена. Обновите страницу и войдите снова при необходимости.');
                    window.location.reload();
                  }, 'База восстановлена');
                }}
              >
                Восстановить
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="admin-panel danger-panel">
        <h3>Очистка данных</h3>
        <p>
          Полный чистый лист: все справочники, документы, запасы и заказы становятся пустыми. Остаются
          только пользователь Admin (пароль не меняется), роли и два пустых склада.
        </p>
        {canWrite && (
          <>
            <label>
              Введите <code>CLEAR</code> для подтверждения
              <input
                value={clearConfirm}
                onChange={(e) => setClearConfirm(e.target.value)}
                disabled={busy}
                autoComplete="off"
              />
            </label>
            <button
              type="button"
              disabled={busy || clearConfirm !== 'CLEAR'}
              onClick={() => {
                void run(async () => {
                  const res = (await api.clearAllData('CLEAR')) as { counts?: { materials?: number } };
                  setClearConfirm('');
                  window.alert(
                    `База очищена (материалов: ${res?.counts?.materials ?? 0}). Страница будет перезагружена — войдите тем же паролем Admin.`
                  );
                  window.location.reload();
                }, 'Данные очищены');
              }}
            >
              Очистить базу
            </button>
          </>
        )}
      </section>

      <section className="admin-panel danger-panel">
        <h3>Демонстрационные данные</h3>
        <p>
          Подгружает исходный демонстрационный слепок (данные проектирования). Текущая база будет
          заменена; перед этим создаётся автослепок. После первой загрузки слепок сохраняется в{' '}
          <code>backend/data/factory/demo.sqlite</code>.
        </p>
        {canWrite && (
          <>
            <label>
              Введите <code>DEMO</code> для подтверждения
              <input
                value={demoConfirm}
                onChange={(e) => setDemoConfirm(e.target.value)}
                disabled={busy}
                autoComplete="off"
              />
            </label>
            <button
              type="button"
              disabled={busy || demoConfirm !== 'DEMO'}
              onClick={() => {
                void run(async () => {
                  const res = (await api.loadDemoData('DEMO')) as { counts?: { materials?: number } };
                  setDemoConfirm('');
                  window.alert(
                    `Демо загружено (материалов: ${res?.counts?.materials ?? '—'}). Страница будет перезагружена.`
                  );
                  window.location.reload();
                }, 'Демо-данные загружены');
              }}
            >
              Загрузить демо-слепок
            </button>
          </>
        )}
      </section>
    </div>
  );
}
