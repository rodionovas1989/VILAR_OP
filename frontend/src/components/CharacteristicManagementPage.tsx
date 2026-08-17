import { FormEvent, useEffect, useState } from 'react';
import { api } from '../api';
import {
  canCreateObject,
  canEditDocumentFields,
  canEditDocumentRecord,
  canRunDocumentActions,
  canViewObject,
} from '../auth/permissions';
import { useAuth } from '../auth/AuthContext';
import { RecentMode, useRecentObjects } from '../auth/RecentObjectsContext';
import { useRecentEntityBridge } from '../hooks/useRecentEntityBridge';
import { displayTimeFromIso, nowTime } from '../utils/docDateTime';
import { userDisplayName } from '../utils/userDisplay';
import AccessDenied from './AccessDenied';
import ActionsMenu, { ActionMenuItem } from './ActionsMenu';
import DocumentTraceModal from './DocumentTraceModal';
import IconButton from './IconButton';
import { Modal } from './Modal';
import RefreshButton from './RefreshButton';
import PageTitle from './PageTitle';
import SearchableSelect from './SearchableSelect';
import {
  CharacteristicDocument,
  CharacteristicDocumentLine,
  CharacteristicValueEntry,
  DocumentTrace,
} from '../types.documents';
import { Lot, LotCharacteristic, Material } from '../types';
import { newId } from '../utils/id';

type Props = {
  materials: Material[];
  lots: Lot[];
};

type FormMode = 'create' | 'edit' | 'view';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Создан',
  posted: 'Проведён',
  cancelled: 'Отменён',
};

function timeOf(doc: { time?: string | null; createdAt?: string }) {
  return doc.time || displayTimeFromIso(doc.createdAt || '') || '—';
}

function emptyLine(): CharacteristicDocumentLine {
  return { id: newId(), materialId: '', lotId: '', values: [] };
}

function lotsForMaterial(lots: Lot[], materialId: string) {
  return lots.filter((l) => l.materialId === materialId);
}

export default function CharacteristicManagementPage({ materials, lots }: Props) {
  const { user, openLogin } = useAuth();
  const { remember, drop } = useRecentObjects();
  const objectId = 'characteristic_documents';
  const permissions = user?.permissions;
  const loggedIn = Boolean(user);

  const [rows, setRows] = useState<CharacteristicDocument[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [editing, setEditing] = useState<CharacteristicDocument | null>(null);
  const [formMode, setFormMode] = useState<FormMode>('create');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [traceOpen, setTraceOpen] = useState(false);
  const [trace, setTrace] = useState<DocumentTrace | null>(null);
  const [traceLoading, setTraceLoading] = useState(false);

  const userLabel = (userId?: string | null) => userDisplayName(users, userId);

  const load = async () => {
    const [docs, userRows] = await Promise.all([
      api.listCharacteristicDocuments(),
      api.list<{ id: string; name: string }>('users').catch(() => []),
    ]);
    setRows(docs);
    setUsers(userRows);
  };

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  useEffect(() => {
    if (!traceOpen || !editing?.id) return;
    let cancelled = false;
    setTraceLoading(true);
    api
      .getCharacteristicDocumentRelated(editing.id)
      .then((data) => {
        if (!cancelled) setTrace(data);
      })
      .catch(() => {
        if (!cancelled) setTrace(null);
      })
      .finally(() => {
        if (!cancelled) setTraceLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [traceOpen, editing?.id, editing?.status, editing?.number]);

  if (!canViewObject(permissions, objectId, loggedIn)) {
    return <AccessDenied title="Управление характеристиками" />;
  }

  const cloneDoc = (doc: CharacteristicDocument): CharacteristicDocument => ({
    ...doc,
    lines: (doc.lines || []).map((l) => ({
      ...l,
      values: (l.values || []).map((v) => ({ ...v })),
    })),
  });

  const closeForm = () => {
    setEditing(null);
    setFormMode('create');
    setError('');
    setTraceOpen(false);
    setTrace(null);
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
      type: 'lot_characteristic_management',
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

  const openEdit = (doc: CharacteristicDocument) => {
    if (!canEditDocumentRecord(permissions, objectId, doc.status)) return;
    setFormMode('edit');
    setEditing({ ...cloneDoc(doc), time: doc.time || timeOf(doc) });
    if (doc.id) {
      remember({ pageId: objectId, entityId: doc.id, label: doc.number, mode: 'edit' });
    }
  };

  const openView = (doc: CharacteristicDocument) => {
    setFormMode('view');
    setEditing({ ...cloneDoc(doc), time: doc.time || timeOf(doc) });
    if (doc.id) {
      remember({ pageId: objectId, entityId: doc.id, label: doc.number, mode: 'view' });
    }
  };

  const openFromRecent = async (entityId: string, mode: RecentMode) => {
    let doc = rows.find((r) => r.id === entityId);
    if (!doc) {
      try {
        doc = await api.getCharacteristicDocument(entityId);
      } catch {
        drop(objectId, entityId);
        setError('Документ не найден или недоступен');
        return;
      }
    }
    if (mode === 'edit' && canEditDocumentRecord(permissions, objectId, doc.status)) {
      openEdit(doc);
      return;
    }
    openView(doc);
  };

  useRecentEntityBridge({
    pageId: objectId,
    entityId: editing?.id || null,
    formMode,
    openEntity: openFromRecent,
    closeModal: closeForm,
  });

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

  const buildBody = (doc: CharacteristicDocument) => ({
    date: doc.date,
    time: doc.time || nowTime(),
    comment: doc.comment || '',
    lines: (doc.lines || []).map((l) => ({
      id: l.id || newId(),
      materialId: l.materialId,
      lotId: l.lotId,
      values: (l.values || []).map((v) => ({
        characteristicId: v.characteristicId,
        value: v.value,
      })),
    })),
  });

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    setError('');
    try {
      const body = buildBody(editing);
      const saved = editing.id
        ? await api.updateCharacteristicDocument(editing.id, body)
        : await api.createCharacteristicDocument({ ...body, createdByUserId: user?.id });
      setEditing(cloneDoc(saved));
      setFormMode('edit');
      if (saved.id) {
        remember({ pageId: objectId, entityId: saved.id, label: saved.number, mode: 'edit' });
      }
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
      if (canEditFields) await api.updateCharacteristicDocument(editing.id, buildBody(editing));
      const saved = await api.postCharacteristicDocument(editing.id);
      setEditing(cloneDoc(saved));
      setFormMode('view');
      if (saved.id) {
        remember({ pageId: objectId, entityId: saved.id, label: saved.number, mode: 'view' });
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!editing?.id) return;
    if (!confirm('Отменить документ? Текущие значения откатятся к предыдущему проведению.')) return;
    setBusy(true);
    setError('');
    try {
      const saved = await api.cancelCharacteristicDocument(editing.id);
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

  const mergeValues = (
    defs: LotCharacteristic[],
    prev: CharacteristicValueEntry[]
  ): CharacteristicValueEntry[] =>
    defs.map((d) => ({
      characteristicId: d.id,
      code: d.code,
      name: d.name,
      unit: d.unit,
      value: prev.find((p) => p.characteristicId === d.id)?.value ?? null,
    }));

  const updateLine = async (idx: number, patch: Partial<CharacteristicDocumentLine>) => {
    if (!editing) return;
    const lines = [...(editing.lines || [])];
    const next = { ...lines[idx], ...patch };
    if (patch.materialId !== undefined) {
      next.lotId = '';
      next.values = [];
      if (next.materialId) {
        try {
          const defs = await api.applicableCharacteristics(next.materialId);
          next.values = mergeValues(defs, []);
        } catch {
          next.values = [];
        }
      }
    }
    lines[idx] = next;
    setEditing({ ...editing, lines });
  };

  const setValue = (lineIdx: number, characteristicId: string, raw: string) => {
    if (!editing) return;
    const lines = [...(editing.lines || [])];
    const line = lines[lineIdx];
    const values = (line.values || []).map((v) =>
      v.characteristicId === characteristicId
        ? { ...v, value: raw === '' ? null : Number(raw) }
        : v
    );
    lines[lineIdx] = { ...line, values };
    setEditing({ ...editing, lines });
  };

  return (
    <div className="page">
      <div className="page-toolbar">
        <PageTitle pageId="characteristic_documents" title="Управление характеристиками" />
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
        Факт по партии (количественное содержание, потеря массы при высушивании и пользовательские
        поля). В строке только характеристики из применения материала. Проведение обновляет регистр
        состояния. Пустое поле не меняет текущее значение. Приёмка запас не трогает эти регистры.
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
          title={editing.id ? `Характеристики ${editing.number}` : 'Новый документ характеристик'}
          onClose={closeForm}
          wide
          className="modal-doc"
          headerExtra={
            <>
              <span className="doc-status-cluster">
                {editing.id ? (
                  <IconButton
                    icon="links"
                    label="Связанные объекты"
                    tone="muted"
                    onClick={() => setTraceOpen(true)}
                  />
                ) : null}
                <span className={`doc-status-badge doc-status-${editing.status || 'draft'}`}>
                  {STATUS_LABEL[editing.status] || editing.status}
                </span>
              </span>
              <ActionsMenu items={actions} onSelect={onAction} disabled={busy} />
            </>
          }
          footer={
            <button type="button" className="ghost" onClick={closeForm}>
              Закрыть
            </button>
          }
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
            {(editing.lines || []).map((line, idx) => (
              <div key={line.id || idx} className="char-doc-line">
                <div className="form-grid">
                  <label>
                    Материал
                    <SearchableSelect
                      value={line.materialId || ''}
                      disabled={!canEditFields}
                      onChange={(v) => void updateLine(idx, { materialId: v })}
                      options={materials.map((m) => ({ value: m.id, label: m.name }))}
                    />
                  </label>
                  <label>
                    Партия
                    <SearchableSelect
                      value={line.lotId || ''}
                      disabled={!canEditFields || !line.materialId}
                      onChange={(v) => void updateLine(idx, { lotId: v })}
                      options={lotsForMaterial(lots, line.materialId || '').map((l) => ({
                        value: l.id,
                        label: l.number,
                      }))}
                    />
                  </label>
                  {canEditFields && (
                    <div>
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
                        Удалить строку
                      </button>
                    </div>
                  )}
                </div>
                {(line.values || []).length ? (
                  <div className="form-grid">
                    {(line.values || []).map((v) => (
                      <label key={v.characteristicId}>
                        {v.name || v.code}
                        {v.unit ? `, ${v.unit}` : ''}
                        <input
                          type="number"
                          step="any"
                          disabled={!canEditFields}
                          value={v.value ?? ''}
                          onChange={(e) => setValue(idx, v.characteristicId, e.target.value)}
                        />
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="muted">
                    {line.materialId
                      ? 'Для материала нет характеристик в применении — назначьте их в справочнике «Характеристики партий»'
                      : 'Выберите материал — появятся поля по правилам применения'}
                  </p>
                )}
              </div>
            ))}
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

      <DocumentTraceModal
        open={traceOpen && Boolean(editing?.id)}
        onClose={() => setTraceOpen(false)}
        heading={
          editing?.number
            ? `Связи: Управление характеристиками ${editing.number}`
            : 'Связи документа характеристик'
        }
        trace={trace}
        loading={traceLoading}
        materials={materials}
        lots={lots}
      />
    </div>
  );
}
