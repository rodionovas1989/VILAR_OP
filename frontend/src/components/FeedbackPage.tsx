import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import {
  canCreateObject,
  canModifyObject,
  canViewObject,
} from '../auth/permissions';
import { useAuth } from '../auth/AuthContext';
import { allCatalogItems } from '../constants/navConfig';
import { useListTable, ListColumn } from '../hooks/useListTable';
import { FeedbackCategory, FeedbackStatus, FeedbackTicket } from '../types';
import { dateFromIso, displayTimeFromIso } from '../utils/docDateTime';
import AccessDenied from './AccessDenied';
import ActionsMenu, { ActionMenuItem } from './ActionsMenu';
import IconButton from './IconButton';
import { Modal } from './Modal';
import PageTitle from './PageTitle';
import RefreshButton from './RefreshButton';
import ListTableHeader from './ListTableHeader';
import { ListViewSettingsButton, ListViewSettingsPanel } from './ListViewSettings';

const OBJECT_ID = 'admin_feedback';
const PAGE_ID = 'admin_feedback';

const CATEGORY_LABEL: Record<FeedbackCategory, string> = {
  понравилось: 'Понравилось',
  улучшить: 'Улучшить',
  ошибка: 'Ошибка',
  вопрос: 'Вопрос',
};

const STATUS_LABEL: Record<FeedbackStatus, string> = {
  новый: 'Новый',
  'в работе': 'В работе',
  закрыт: 'Закрыт',
  отклонён: 'Отклонён',
};

const STATUS_CLASS: Record<FeedbackStatus, string> = {
  новый: 'draft',
  'в работе': 'posted',
  закрыт: 'fulfilled',
  отклонён: 'cancelled',
};

type FormMode = 'create' | 'edit' | 'view';

function emptyTicket(user?: { id: string; name?: string; login?: string } | null): FeedbackTicket {
  return {
    id: '',
    number: '(новый)',
    createdAt: '',
    createdByUserId: user?.id || '',
    createdByName: user?.name || user?.login || '',
    category: 'улучшить',
    title: '',
    body: '',
    pageId: '',
    pageLabel: '',
    status: 'новый',
    adminComment: '',
  };
}

export default function FeedbackPage() {
  const { user, openLogin } = useAuth();
  const permissions = user?.permissions;
  const loggedIn = Boolean(user);
  const canView = canViewObject(permissions, OBJECT_ID, loggedIn);
  const canCreate = canCreateObject(permissions, OBJECT_ID);
  const canModerate = canModifyObject(permissions, OBJECT_ID);

  const [rows, setRows] = useState<FeedbackTicket[]>([]);
  const [editing, setEditing] = useState<FeedbackTicket | null>(null);
  const [formMode, setFormMode] = useState<FormMode>('create');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [listSettingsOpen, setListSettingsOpen] = useState(false);

  const pages = useMemo(() => allCatalogItems(), []);

  const listColumns = useMemo((): ListColumn<FeedbackTicket>[] => {
    return [
      { key: 'number', label: 'Номер', getValue: (r) => r.number },
      { key: 'date', label: 'Дата', getValue: (r) => dateFromIso(r.createdAt) },
      { key: 'time', label: 'Время', getValue: (r) => displayTimeFromIso(r.createdAt) },
      {
        key: 'category',
        label: 'Категория',
        getValue: (r) => CATEGORY_LABEL[r.category] || r.category,
      },
      { key: 'title', label: 'Тема', getValue: (r) => r.title },
      {
        key: 'status',
        label: 'Статус',
        getValue: (r) => STATUS_LABEL[r.status] || r.status,
        render: (r) => (
          <span className={`doc-status-badge doc-status-${STATUS_CLASS[r.status] || 'draft'}`}>
            {STATUS_LABEL[r.status] || r.status}
          </span>
        ),
      },
      { key: 'author', label: 'Автор', getValue: (r) => r.createdByName || r.createdByUserId },
      { key: 'page', label: 'Раздел', getValue: (r) => r.pageLabel || '—' },
    ];
  }, []);

  const listTable = useListTable(rows, listColumns, {
    persistKey: PAGE_ID,
    userId: user?.id,
  });

  const load = async () => {
    setError('');
    try {
      setRows(await api.list<FeedbackTicket>('feedback'));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => {
    load().catch(console.error);
  }, []);

  const isOwner = (row: FeedbackTicket) => Boolean(user?.id) && row.createdByUserId === user?.id;
  const canEditContent = (row: FeedbackTicket | null) => {
    if (formMode === 'view' || !canCreate) return false;
    if (formMode === 'create' || !row?.id) return true;
    return isOwner(row) && row.status === 'новый';
  };
  const canEditReply = formMode !== 'view' && canModerate && Boolean(editing?.id);

  const closeForm = () => {
    setEditing(null);
    setFormMode('create');
  };

  const startCreate = () => {
    if (!canCreate) {
      openLogin();
      return;
    }
    setFormMode('create');
    setEditing(emptyTicket(user));
  };

  const openView = (row: FeedbackTicket) => {
    setFormMode('view');
    setEditing({ ...row });
  };

  const openEdit = (row: FeedbackTicket) => {
    const ownerNew = isOwner(row) && row.status === 'новый' && canCreate;
    if (!canModerate && !ownerNew) return;
    setFormMode('edit');
    setEditing({ ...row });
  };

  const canSave =
    Boolean(editing) && (formMode === 'create' ? canCreate : canEditContent(editing) || canEditReply);

  const persist = async (row: FeedbackTicket) => {
    const pageMeta = pages.find((p) => p.id === row.pageId);
    const body = {
      category: row.category,
      title: row.title.trim(),
      body: row.body.trim(),
      pageId: row.pageId || '',
      pageLabel: pageMeta ? `${pageMeta.groupLabel} / ${pageMeta.label}` : row.pageLabel || '',
      status: row.status,
      adminComment: row.adminComment || '',
    };
    if (row.id) return api.update<FeedbackTicket>('feedback', row.id, body);
    return api.create<FeedbackTicket>('feedback', body);
  };

  const save = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!editing) return;
    if (formMode === 'create' && !canCreate) return;
    if (formMode !== 'create' && !canEditContent(editing) && !canEditReply) return;
    if (!editing.title.trim()) {
      setError('Укажите тему');
      return;
    }
    if (!editing.body.trim()) {
      setError('Опишите обращение');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const saved = await persist(editing);
      await load();
      if (formMode === 'create' && !canModerate) {
        closeForm();
        return;
      }
      setEditing({ ...saved });
      setFormMode(canModerate || (isOwner(saved) && saved.status === 'новый') ? 'edit' : 'view');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (status: FeedbackStatus) => {
    if (!editing?.id || !canModerate) return;
    setBusy(true);
    setError('');
    try {
      const saved = await api.update<FeedbackTicket>('feedback', editing.id, {
        status,
      });
      setEditing({ ...saved });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const removeTicket = async () => {
    if (!editing?.id) return;
    if (!confirm('Удалить обращение?')) return;
    setBusy(true);
    setError('');
    try {
      await api.remove('feedback', editing.id);
      closeForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const actions: ActionMenuItem[] = [];
  if (editing?.id && canModerate) {
    if (editing.status === 'новый') actions.push({ id: 'progress', label: 'В работу' });
    if (editing.status !== 'закрыт') actions.push({ id: 'done', label: 'Закрыть' });
    if (editing.status !== 'отклонён' && editing.status !== 'закрыт') {
      actions.push({ id: 'reject', label: 'Отклонить', danger: true });
    }
  }
  if (
    editing?.id &&
    (canModerate || (isOwner(editing) && editing.status === 'новый' && canCreate))
  ) {
    actions.push({ id: 'delete', label: 'Удалить', danger: true });
  }

  const handleAction = async (id: string) => {
    if (id === 'progress') return setStatus('в работе');
    if (id === 'done') return setStatus('закрыт');
    if (id === 'reject') return setStatus('отклонён');
    if (id === 'delete') return removeTicket();
  };

  if (!canView) {
    return <AccessDenied title="Обратная связь" />;
  }

  const fieldsLocked = !canEditContent(editing);

  return (
    <div className="page">
      <div className="page-toolbar">
        <PageTitle pageId={PAGE_ID} title="Обратная связь" />
        <div className="toolbar-actions">
          {canCreate && (
            <button type="button" onClick={startCreate} disabled={busy}>
              Создать
            </button>
          )}
          <ListViewSettingsButton
            open={listSettingsOpen}
            onOpenChange={setListSettingsOpen}
            activeFilterCount={listTable.activeFilterCount}
            sortRulesCount={listTable.sortRules.length}
          />
          <RefreshButton onClick={() => load()} disabled={busy} />
        </div>
      </div>
      {listSettingsOpen && (
        <ListViewSettingsPanel
          open={listSettingsOpen}
          onClose={() => setListSettingsOpen(false)}
          columns={listColumns}
          filterOptions={listTable.filterOptions}
          filters={listTable.filters}
          sortRules={listTable.sortRules}
          onApply={listTable.applySettings}
          onReset={listTable.resetSettings}
          activeFilterCount={listTable.activeFilterCount}
        />
      )}

      <p className="hint">
        {canModerate
          ? 'Вам доступны все обращения: статус и ответ — право «Изменение» на объекте «Обратная связь» (роль Администратор).'
          : 'Создайте обращение о работе с системой. Планировщик и кладовщик видят только свои тикеты (права «Чтение» и «Создание»). Ответ администратора появится в карточке.'}
      </p>

      {error && !editing && <p className="error">{error}</p>}

      <div className="table-wrap">
        <table className="data-table">
          <ListTableHeader columns={listColumns} extraHead={<th>Действия</th>} />
          <tbody>
            {listTable.displayRows.map((row) => (
              <tr key={row.id}>
                {listColumns.map((col) => (
                  <td key={col.key}>{col.render ? col.render(row) : col.getValue(row)}</td>
                ))}
                <td>
                  <div className="row-actions">
                    <IconButton icon="view" label="Просмотр" tone="muted" onClick={() => openView(row)} />
                    {(canModerate || (isOwner(row) && row.status === 'новый' && canCreate)) && (
                      <IconButton icon="edit" label="Изменить" onClick={() => openEdit(row)} />
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!listTable.displayRows.length && (
              <tr>
                <td colSpan={listColumns.length + 1} className="muted">
                  Нет обращений по выбранным отборам
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal
          open
          title={
            formMode === 'create'
              ? 'Новое обращение'
              : `${formMode === 'view' ? 'Просмотр' : 'Обращение'} — ${editing.number}`
          }
          onClose={closeForm}
          wide
          className="modal-doc"
          headerExtra={
            <>
              <span className={`doc-status-badge doc-status-${STATUS_CLASS[editing.status] || 'draft'}`}>
                {STATUS_LABEL[editing.status] || (formMode === 'create' ? 'Новый' : editing.status)}
              </span>
              {actions.length > 0 && (
                <ActionsMenu
                  items={actions}
                  onSelect={(id) => {
                    handleAction(id).catch(console.error);
                  }}
                  disabled={busy}
                />
              )}
              {formMode === 'view' && <span className="doc-status-hint">Только просмотр</span>}
            </>
          }
          footer={
            <>
              {canSave && (
                <button type="submit" form="feedback-form" disabled={busy}>
                  {editing.id ? 'Сохранить' : 'Отправить'}
                </button>
              )}
              <button type="button" className="ghost" onClick={closeForm}>
                Закрыть
              </button>
            </>
          }
        >
          {error && <p className="error">{error}</p>}
          <form id="feedback-form" className="doc-form" onSubmit={save}>
            <div className="form-grid doc-header-grid">
              <label>
                Категория
                {fieldsLocked ? (
                  <span className="readonly-field">{CATEGORY_LABEL[editing.category] || editing.category}</span>
                ) : (
                  <select
                    value={editing.category}
                    onChange={(e) =>
                      setEditing({ ...editing, category: e.target.value as FeedbackCategory })
                    }
                    required
                  >
                    {(Object.keys(CATEGORY_LABEL) as FeedbackCategory[]).map((key) => (
                      <option key={key} value={key}>
                        {CATEGORY_LABEL[key]}
                      </option>
                    ))}
                  </select>
                )}
              </label>
              <label>
                Раздел системы
                {fieldsLocked ? (
                  <span className="readonly-field">{editing.pageLabel || '—'}</span>
                ) : (
                  <select
                    value={editing.pageId || ''}
                    onChange={(e) => setEditing({ ...editing, pageId: e.target.value })}
                  >
                    <option value="">Не указан</option>
                    {pages.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.groupLabel} / {p.label}
                      </option>
                    ))}
                  </select>
                )}
              </label>
              {editing.createdByName && (
                <label>
                  Автор
                  <span className="readonly-field">{editing.createdByName}</span>
                </label>
              )}
            </div>
            <label>
              Тема
              {fieldsLocked ? (
                <span className="readonly-field">{editing.title}</span>
              ) : (
                <input
                  value={editing.title}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  required
                  maxLength={200}
                />
              )}
            </label>
            <label>
              Сообщение
              {fieldsLocked ? (
                <div className="readonly-field readonly-multiline">{editing.body || '—'}</div>
              ) : (
                <textarea
                  value={editing.body}
                  onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                  rows={6}
                  required
                  placeholder="Что удобно в работе, где возникают сложности, что улучшить"
                />
              )}
            </label>
            {(Boolean(editing.id) && (canModerate || Boolean(editing.adminComment))) && (
              <label>
                Ответ
                {canEditReply ? (
                  <textarea
                    value={editing.adminComment || ''}
                    onChange={(e) => setEditing({ ...editing, adminComment: e.target.value })}
                    rows={4}
                    placeholder="Комментарий администратора"
                  />
                ) : (
                  <div className="readonly-field readonly-multiline">
                    {editing.adminComment || '—'}
                    {editing.respondedByName ? (
                      <div className="hint" style={{ marginTop: 6 }}>
                        {editing.respondedByName}
                        {editing.respondedAt ? ` · ${displayTimeFromIso(editing.respondedAt)}` : ''}
                      </div>
                    ) : null}
                  </div>
                )}
              </label>
            )}
          </form>
        </Modal>
      )}
    </div>
  );
}
