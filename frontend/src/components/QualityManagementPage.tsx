import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import {
  canCreateObject,
  canEditDocumentFields,
  canEditDocumentRecord,
  canRunDocumentActions,
  canViewObject,
} from '../auth/permissions';
import { useAuth } from '../auth/AuthContext';
import { displayTimeFromIso, nowTime } from '../utils/docDateTime';
import { userDisplayName } from '../utils/userDisplay';
import AccessDenied from './AccessDenied';
import ActionsMenu, { ActionMenuItem } from './ActionsMenu';
import IconButton from './IconButton';
import { Modal } from './Modal';
import RefreshButton from './RefreshButton';
import PageTitle from './PageTitle';
import { QualityDocument, QualityDocumentLine } from '../types.documents';
import { Lot, Material } from '../types';
import { newId } from '../utils/id';

type LotQuality = { id: string; name: string; permission: string; active?: boolean };

type Props = {
  materials: Material[];
  lots: Lot[];
  lotQualities: LotQuality[];
};

type FormMode = 'create' | 'edit' | 'view';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Создан',
  posted: 'Проведён',
  cancelled: 'Отменён',
};

const PERMISSION_LABEL: Record<string, string> = {
  fit: 'Годен',
  conditional: 'Условно годен',
  unfit: 'Не годен',
};

function timeOf(doc: { time?: string | null; createdAt?: string }) {
  return doc.time || displayTimeFromIso(doc.createdAt || '') || '—';
}

function emptyLine(): QualityDocumentLine {
  return { id: newId(), materialId: '', lotId: '', qualityId: '' };
}

function lotsForMaterial(lots: Lot[], materialId: string) {
  return lots.filter((l) => l.materialId === materialId);
}

export default function QualityManagementPage({ materials, lots, lotQualities }: Props) {
  const { user, openLogin } = useAuth();
  const objectId = 'quality_documents';
  const permissions = user?.permissions;
  const loggedIn = Boolean(user);

  const [rows, setRows] = useState<QualityDocument[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [editing, setEditing] = useState<QualityDocument | null>(null);
  const [formMode, setFormMode] = useState<FormMode>('create');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const userLabel = (userId?: string | null) => userDisplayName(users, userId);
  const activeQualities = useMemo(
    () => lotQualities.filter((q) => q.active !== false),
    [lotQualities]
  );

  const load = async () => {
    const [docs, userRows] = await Promise.all([
      api.listQualityDocuments(),
      api.list<{ id: string; name: string }>('users').catch(() => []),
    ]);
    setRows(docs);
    setUsers(userRows);
  };

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  if (!canViewObject(permissions, objectId, loggedIn)) {
    return <AccessDenied title="Управление качеством" />;
  }

  const cloneDoc = (doc: QualityDocument): QualityDocument => ({
    ...doc,
    lines: (doc.lines || []).map((l) => ({ ...l })),
  });

  const closeForm = () => {
    setEditing(null);
    setFormMode('create');
    setError('');
  };

  const startCreate = () => {
    if (!loggedIn) {
      openLogin();
      return;
    }
    if (!canCreateObject(permissions, objectId)) {
      window.alert('Недостаточно прав на создание документов.');
      return;
    }
    setFormMode('create');
    setEditing({
      id: '',
      type: 'quality_management',
      number: '(новый)',
      date: new Date().toISOString().slice(0, 10),
      time: nowTime(),
      status: 'draft',
      createdByUserId: user?.id || '',
      createdAt: '',
      comment: '',
      lines: [emptyLine()],
    });
    setError('');
  };

  const openEdit = (doc: QualityDocument) => {
    if (!canEditDocumentRecord(permissions, objectId, doc.status)) return;
    setFormMode('edit');
    setEditing({ ...cloneDoc(doc), time: doc.time || timeOf(doc) });
  };

  const openView = (doc: QualityDocument) => {
    setFormMode('view');
    setEditing({ ...cloneDoc(doc), time: doc.time || timeOf(doc) });
  };

  const docStatus = editing?.status || 'draft';
  const canEditFields = editing
    ? canEditDocumentFields(permissions, objectId, docStatus, formMode)
    : false;
  const canRun = canRunDocumentActions(permissions, objectId);

  const actions: ActionMenuItem[] = [];
  if (editing && canEditFields && formMode !== 'view') {
    actions.push({ id: 'save', label: editing.id ? 'Сохранить' : 'Сохранить черновик' });
  }
  if (editing?.id && docStatus === 'draft' && canRun && formMode !== 'view') {
    actions.push({ id: 'post', label: 'Провести' });
  }
  if (editing?.id && docStatus !== 'cancelled' && canRun) {
    actions.push({ id: 'cancel', label: 'Отменить', danger: true });
  }

  const buildBody = (doc: QualityDocument) => ({
    type: 'quality_management' as const,
    date: doc.date,
    time: doc.time || nowTime(),
    comment: doc.comment || '',
    lines: (doc.lines || []).map((l) => ({
      id: l.id || newId(),
      materialId: l.materialId,
      lotId: l.lotId,
      qualityId: l.qualityId,
    })),
  });

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    setError('');
    try {
      const body = buildBody(editing);
      const saved = editing.id
        ? await api.updateQualityDocument(editing.id, body)
        : await api.createQualityDocument({ ...body, createdByUserId: user?.id });
      setEditing(cloneDoc(saved));
      setFormMode('edit');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const post = async () => {
    if (!editing?.id) return;
    setBusy(true);
    setError('');
    try {
      if (canEditFields) await api.updateQualityDocument(editing.id, buildBody(editing));
      const saved = await api.postQualityDocument(editing.id, user?.id || '');
      setEditing(cloneDoc(saved));
      setFormMode('view');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!editing?.id) return;
    if (!confirm('Отменить документ? Состояние партий откатится к предыдущему проведению или к «Годен».')) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      const saved = await api.cancelQualityDocument(editing.id, user?.id || '');
      setEditing(cloneDoc(saved));
      setFormMode('view');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onAction = (id: string) => {
    if (id === 'save') return save();
    if (id === 'post') return post();
    if (id === 'cancel') return cancel();
  };

  const updateLine = (idx: number, patch: Partial<QualityDocumentLine>) => {
    if (!editing) return;
    const lines = [...(editing.lines || [])];
    const next = { ...lines[idx], ...patch };
    if (patch.materialId !== undefined) next.lotId = '';
    lines[idx] = next;
    setEditing({ ...editing, lines });
  };

  return (
    <div className="page">
      <div className="page-toolbar">
        <PageTitle pageId="quality_documents" title="Управление качеством" />
        <div className="toolbar-actions">
          <RefreshButton onClick={() => load()} disabled={busy} />
          {canCreateObject(permissions, objectId) && (
            <button type="button" onClick={startCreate} disabled={busy}>
              Создать
            </button>
          )}
        </div>
      </div>
      <p className="hint">
        Материал → партия → качество из справочника. Проведение обновляет регистр состояния и историю. Нет записи —
        партия по умолчанию «Годен».
      </p>
      {error && !editing && <p className="error">{error}</p>}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Номер</th>
              <th>Дата</th>
              <th>Время</th>
              <th>Статус</th>
              <th>Строк</th>
              <th>Автор</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((doc) => (
              <tr key={doc.id}>
                <td>{doc.number}</td>
                <td>{doc.date}</td>
                <td>{doc.time || timeOf(doc)}</td>
                <td>{STATUS_LABEL[doc.status] || doc.status}</td>
                <td>{(doc.lines || []).length}</td>
                <td>{userLabel(doc.createdByUserId)}</td>
                <td>
                  <div className="row-actions">
                    <IconButton icon="view" label="Просмотр" tone="muted" onClick={() => openView(doc)} />
                    {canEditDocumentRecord(permissions, objectId, doc.status) && (
                      <IconButton icon="edit" label="Изменить" onClick={() => openEdit(doc)} />
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={7} className="muted">
                  Нет документов
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal
          open
          title={editing.id ? `Управление качеством ${editing.number}` : 'Новый документ качества'}
          onClose={closeForm}
          wide
          className="modal-doc"
          headerExtra={<ActionsMenu items={actions} onSelect={onAction} disabled={busy} />}
        >
          <form
            className="doc-form"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              if (canEditFields) save();
            }}
          >
            {error && <p className="error">{error}</p>}
            <div className="form-grid">
              <label>
                Номер
                <input value={editing.number} readOnly />
              </label>
              <label>
                Дата
                <input
                  type="date"
                  value={editing.date}
                  disabled={!canEditFields}
                  onChange={(e) => setEditing({ ...editing, date: e.target.value })}
                />
              </label>
              <label>
                Время
                <input
                  type="time"
                  step={1}
                  value={(editing.time || nowTime()).slice(0, 8)}
                  disabled={!canEditFields}
                  onChange={(e) => setEditing({ ...editing, time: e.target.value })}
                />
              </label>
              <label>
                Статус
                <input value={STATUS_LABEL[editing.status] || editing.status} readOnly />
              </label>
              <label className="span-2">
                Комментарий
                <input
                  value={editing.comment || ''}
                  disabled={!canEditFields}
                  onChange={(e) => setEditing({ ...editing, comment: e.target.value })}
                />
              </label>
            </div>

            <h3>Строки</h3>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Материал</th>
                    <th>Партия</th>
                    <th>Качество</th>
                    <th>Разрешение</th>
                    {canEditFields && <th />}
                  </tr>
                </thead>
                <tbody>
                  {(editing.lines || []).map((line, idx) => {
                    const q = lotQualities.find((x) => x.id === line.qualityId);
                    return (
                      <tr key={line.id || idx}>
                        <td>
                          <select
                            value={line.materialId || ''}
                            disabled={!canEditFields}
                            onChange={(e) => updateLine(idx, { materialId: e.target.value })}
                          >
                            <option value="">—</option>
                            {materials.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <select
                            value={line.lotId || ''}
                            disabled={!canEditFields || !line.materialId}
                            onChange={(e) => updateLine(idx, { lotId: e.target.value })}
                          >
                            <option value="">—</option>
                            {lotsForMaterial(lots, line.materialId || '').map((l) => (
                              <option key={l.id} value={l.id}>
                                {l.number}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <select
                            value={line.qualityId || ''}
                            disabled={!canEditFields}
                            onChange={(e) => updateLine(idx, { qualityId: e.target.value })}
                          >
                            <option value="">—</option>
                            {activeQualities.map((qq) => (
                              <option key={qq.id} value={qq.id}>
                                {qq.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>{q ? PERMISSION_LABEL[q.permission] || q.permission : '—'}</td>
                        {canEditFields && (
                          <td>
                            <button
                              type="button"
                              className="ghost"
                              onClick={() =>
                                setEditing({
                                  ...editing,
                                  lines: (editing.lines || []).filter((_, i) => i !== idx),
                                })
                              }
                            >
                              ×
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {canEditFields && (
              <button
                type="button"
                className="ghost"
                onClick={() => setEditing({ ...editing, lines: [...(editing.lines || []), emptyLine()] })}
              >
                + Строка
              </button>
            )}
          </form>
        </Modal>
      )}
    </div>
  );
}
