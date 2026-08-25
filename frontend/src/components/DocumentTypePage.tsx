import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useListTable, ListColumn } from '../hooks/useListTable';
import { useRecentEntityBridge } from '../hooks/useRecentEntityBridge';
import { RecentMode, useRecentObjects } from '../auth/RecentObjectsContext';
import {
  canCreateObject,
  canEditDocumentFields,
  canEditDocumentRecord,
  canRunDocumentActions,
  canViewObject,
  isPostedDocumentEdit,
} from '../auth/permissions';
import { useAuth } from '../auth/AuthContext';
import { PermissionMap } from '../constants/systemObjects';
import { displayDocTime, nowTime, timeFromIso } from '../utils/docDateTime';
import { userDisplayName } from '../utils/userDisplay';
import AccessDenied from './AccessDenied';
import ActionsMenu, { ActionMenuItem } from './ActionsMenu';
import CollapsibleSection from './CollapsibleSection';
import DocumentTraceModal from './DocumentTraceModal';
import IconButton from './IconButton';
import { Modal } from './Modal';
import RefreshButton from './RefreshButton';
import PageTitle from './PageTitle';
import ListTableHeader from './ListTableHeader';
import { ListViewSettingsButton, ListViewSettingsPanel } from './ListViewSettings';
import SearchableSelect from './SearchableSelect';
import DecimalInput from './DecimalInput';
import { DocumentTypeMeta, DocumentTrace, MaterialMovementRow, StockDocument, StockDocumentLine, StockDocumentType, StockRow } from '../types.documents';
import { Lot, Material, Warehouse } from '../types';
import { metaForDocumentType } from '../constants/documentTypes';
import { newId } from '../utils/id';
import { formatQty, formatQtyDelta, roundQty } from '../utils/qty';

type Props = {
  documentType: StockDocumentType;
  materials: Material[];
  lots: Lot[];
  warehouses: Warehouse[];
};

type FormMode = 'create' | 'edit' | 'view';
type InvTab = 'plan' | 'fact' | 'diff';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Создан',
  posted: 'Проведён',
  cancelled: 'Отменён',
  fulfilled: 'Выполнен',
};

function emptyLine(): StockDocumentLine {
  return { id: newId(), materialId: '', lotId: '', quantity: 0 };
}

function emptyInvFactLine(): StockDocumentLine {
  return {
    id: newId(),
    materialId: '',
    lotId: '',
    quantity: 0,
    bookQuantity: 0,
    actualQuantity: 0,
  };
}

function invLineKey(line: Pick<StockDocumentLine, 'materialId' | 'lotId'>) {
  return `${line.materialId}::${line.lotId}`;
}

function lotsForMaterial(lots: Lot[], materialId: string) {
  return lots.filter((l) => l.materialId === materialId);
}

function buildDocumentActions(
  doc: StockDocument | null,
  formMode: FormMode,
  permissions: PermissionMap | undefined,
  objectId: string,
  isNew: boolean
): ActionMenuItem[] {
  const items: ActionMenuItem[] = [];
  const status = doc?.status || 'draft';
  const canEdit = doc
    ? canEditDocumentFields(permissions, objectId, status, formMode)
    : formMode === 'create' && canCreateObject(permissions, objectId);
  const canRun = canRunDocumentActions(permissions, objectId);
  const postedEdit = doc ? isPostedDocumentEdit(permissions, objectId, status) : false;

  if (canEdit && formMode !== 'view' && !postedEdit) {
    items.push({ id: 'save', label: isNew ? 'Сохранить черновик' : 'Сохранить' });
  }
  if (doc?.id && status === 'draft' && canRun && formMode !== 'view') {
    items.push({ id: 'post', label: 'Провести' });
  }
  if (
    doc?.id &&
    status === 'posted' &&
    postedEdit &&
    formMode === 'edit' &&
    canRun &&
    doc.type !== 'inventory'
  ) {
    items.push({ id: 'repost', label: 'Провести повторно' });
  }
  if (doc?.id && status !== 'cancelled' && status !== 'fulfilled' && canRun) {
    items.push({ id: 'cancel', label: 'Отменить', danger: true });
  }
  if (doc?.id && status === 'posted' && doc.type === 'reservation' && canRun) {
    items.push({ id: 'fulfill', label: 'Отметить выполненным' });
  }
  return items;
}

export default function DocumentTypePage({ documentType, materials, lots, warehouses }: Props) {
  const { user, openLogin } = useAuth();
  const { remember, drop } = useRecentObjects();
  const objectId = `doc_${documentType}`;
  const permissions = user?.permissions;
  const loggedIn = Boolean(user);
  const [typeMeta, setTypeMeta] = useState<DocumentTypeMeta | null>(() => metaForDocumentType(documentType));
  const [rows, setRows] = useState<StockDocument[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [editing, setEditing] = useState<StockDocument | null>(null);
  const [formMode, setFormMode] = useState<FormMode>('create');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [listSettingsOpen, setListSettingsOpen] = useState(false);
  const [trace, setTrace] = useState<DocumentTrace | null>(null);
  const [traceLoading, setTraceLoading] = useState(false);
  const [traceOpen, setTraceOpen] = useState(false);
  const [invTab, setInvTab] = useState<InvTab>('fact');
  const [postInfo, setPostInfo] = useState('');

  const matName = (id: string) => materials.find((m) => m.id === id)?.name || id;
  const lotNum = (id: string) => lots.find((l) => l.id === id)?.number || id;
  const whName = (id: string) => warehouses.find((w) => w.id === id)?.name || id;
  const userLabel = (userId?: string | null) => userDisplayName(users, userId);

  const docWhLabel = (doc: StockDocument) =>
    doc.warehouseId
      ? whName(doc.warehouseId)
      : [doc.warehouseFromId, doc.warehouseToId]
          .filter((id): id is string => Boolean(id))
          .map(whName)
          .join(' → ') || '—';

  const listColumns = useMemo((): ListColumn<StockDocument>[] => {
    return [
      { key: 'number', label: 'Номер', getValue: (d) => d.number },
      { key: 'date', label: 'Дата', getValue: (d) => d.date },
      { key: 'time', label: 'Время', getValue: (d) => displayDocTime(d) },
      {
        key: 'status',
        label: 'Статус',
        getValue: (d) => STATUS_LABEL[d.status] || d.status,
        render: (d) => (
          <span className={`doc-status-badge doc-status-${d.status}`}>
            {STATUS_LABEL[d.status] || d.status}
          </span>
        ),
      },
      { key: 'warehouse', label: 'Склад(ы)', getValue: docWhLabel },
      { key: 'lines', label: 'Строк', getValue: (d) => String(d.lines?.length || 0) },
      {
        key: 'author',
        label: 'Автор',
        getValue: (d) => userLabel(d.createdByUserId),
        render: (d) => <span title={d.createdByUserId}>{userLabel(d.createdByUserId)}</span>,
      },
    ];
  }, [users, warehouses]);

  const listTable = useListTable(rows, listColumns, {
    persistKey: `doc_${documentType}`,
    userId: user?.id,
  });

  const load = async () => {
    setError('');
    try {
      const [meta, docs] = await Promise.all([
        api.documentTypes(),
        api.listDocuments(documentType),
      ]);
      setTypeMeta(meta.types.find((t) => t.id === documentType) || metaForDocumentType(documentType));
      setRows(docs);
    } catch (e) {
      setTypeMeta(metaForDocumentType(documentType));
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => {
    load().catch(console.error);
    api
      .list<{ id: string; name: string }>('users')
      .then(setUsers)
      .catch(console.error);
  }, [documentType]);

  useEffect(() => {
    if (!traceOpen || !editing?.id) return;
    const doc = editing;
    let cancelled = false;
    setTraceLoading(true);
    (async () => {
      try {
        const data = await api.getDocumentRelated(documentType, doc.id);
        if (!cancelled) setTrace(data);
      } catch {
        try {
          const [movements, stock] = await Promise.all([
            api.list<MaterialMovementRow>('material_movements'),
            api.list<StockRow>('stock'),
          ]);
          if (cancelled) return;
          const lotIds = new Set((doc.lines || []).map((l) => l.lotId));
          setTrace({
            document: {
              id: doc.id,
              type: doc.type,
              number: doc.number,
              status: doc.status,
              date: doc.date,
              productionOrderId: doc.productionOrderId,
              basisDocumentId: doc.basisDocumentId,
            },
            movements: movements.filter(
              (m) => m.documentId === doc.id || m.documentNumber === doc.number
            ),
            reservationHistory: [],
            activeReservations: [],
            relatedDocuments: [],
            productionOrder: null,
            stock: stock.filter((s) => lotIds.has(s.lotId)),
          });
        } catch {
          if (!cancelled) setTrace(null);
        }
      } finally {
        if (!cancelled) setTraceLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [traceOpen, documentType, editing?.id, editing?.status, editing?.number]);

  const cloneDoc = (doc: StockDocument): StockDocument => ({
    ...doc,
    lines: (doc.lines || []).map((l) => ({ ...l })),
  });

  const applySavedDoc = (saved: StockDocument, mode: FormMode) => {
    setEditing(cloneDoc(saved));
    setFormMode(mode);
    if (saved.id && (mode === 'view' || mode === 'edit')) {
      remember({
        pageId: objectId,
        entityId: saved.id,
        label: saved.number,
        mode,
      });
    }
  };

  const formModeAfterPost = (saved: StockDocument): FormMode =>
    canEditDocumentRecord(permissions, objectId, saved.status) ? 'edit' : 'view';

  const currentUserId = user?.id || '';
  const docStatus = editing?.status || 'draft';
  const canEditFields = editing
    ? canEditDocumentFields(permissions, objectId, docStatus, formMode)
    : false;
  const postedEdit = editing ? isPostedDocumentEdit(permissions, objectId, docStatus) : false;

  const whComp = warehouses.find((w) => w.type === 'компоненты')?.id || '';

  const closeForm = () => {
    setEditing(null);
    setFormMode('create');
    setTraceOpen(false);
    setInvTab('fact');
    setPostInfo('');
  };

  const linesFromStockPreview = async (warehouseId: string): Promise<StockDocumentLine[]> => {
    const preview = await api.inventoryStockPreview(warehouseId);
    return preview.lines.map((l) => ({
      id: newId(),
      materialId: l.materialId,
      lotId: l.lotId,
      quantity: l.quantity,
      bookQuantity: l.bookQuantity,
      actualQuantity: l.actualQuantity,
    }));
  };

  const applyInventoryWarehouse = async (warehouseId: string, confirmIfFilled: boolean) => {
    if (!editing || editing.type !== 'inventory') return;
    const hasData = editing.lines.some((l) => l.materialId && l.lotId);
    if (confirmIfFilled && hasData) {
      const ok = window.confirm('Перезаполнить план и факт по остаткам выбранного склада?');
      if (!ok) return;
    }
    if (!warehouseId) {
      setEditing({ ...editing, warehouseId: '', lines: [] });
      return;
    }
    setBusy(true);
    setError('');
    try {
      const lines = await linesFromStockPreview(warehouseId);
      setEditing({ ...editing, warehouseId, lines });
      setInvTab('fact');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const startCreate = () => {
    if (!loggedIn) {
      openLogin();
      return;
    }
    if (!canCreateObject(permissions, objectId)) {
      window.alert('Недостаточно прав на создание документов. Проверьте роль или войдите снова.');
      return;
    }
    const meta = typeMeta || metaForDocumentType(documentType);
    if (!typeMeta) setTypeMeta(meta);
    const base: StockDocument = {
      id: '',
      type: documentType,
      number: '(новый)',
      date: new Date().toISOString().slice(0, 10),
      time: nowTime(),
      status: 'draft',
      createdByUserId: currentUserId,
      createdAt: '',
      comment: '',
      lines: documentType === 'inventory' ? [] : [emptyLine()],
      warehouseId: meta.warehouseMode === 'single' ? whComp : null,
      warehouseFromId: meta.warehouseMode === 'from' || meta.warehouseMode === 'both' ? whComp : null,
      warehouseToId: meta.warehouseMode === 'to' ? whComp : null,
    };
    setFormMode('create');
    setEditing(base);
    setError('');
    setPostInfo('');
    setInvTab('fact');
    if (documentType === 'inventory' && whComp) {
      void (async () => {
        try {
          const lines = await linesFromStockPreview(whComp);
          setEditing((d) => (d && d.type === 'inventory' && !d.id ? { ...d, lines } : d));
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        }
      })();
    }
  };

  const openEdit = (doc: StockDocument) => {
    if (!canEditDocumentRecord(permissions, objectId, doc.status)) return;
    setFormMode('edit');
    setEditing({
      ...doc,
      time: doc.time || displayDocTime(doc),
      lines: (doc.lines || []).map((l) => ({ ...l })),
    });
    if (doc.id) {
      remember({ pageId: objectId, entityId: doc.id, label: doc.number, mode: 'edit' });
    }
  };

  const openView = (doc: StockDocument) => {
    setFormMode('view');
    setEditing({
      ...doc,
      time: doc.time || displayDocTime(doc),
      lines: (doc.lines || []).map((l) => ({ ...l })),
    });
    if (doc.id) {
      remember({ pageId: objectId, entityId: doc.id, label: doc.number, mode: 'view' });
    }
  };

  const openFromRecent = async (entityId: string, mode: RecentMode) => {
    let doc = rows.find((r) => r.id === entityId);
    if (!doc) {
      try {
        doc = await api.getDocument(documentType, entityId);
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

  const buildBody = (doc: StockDocument) => ({
    date: doc.date,
    time: doc.time || nowTime(),
    createdByUserId: doc.createdByUserId || currentUserId,
    warehouseId: doc.warehouseId,
    warehouseFromId: doc.warehouseFromId,
    warehouseToId: doc.warehouseToId,
    productionOrderId: doc.productionOrderId,
    seriesId: doc.seriesId,
    comment: doc.comment,
    lines:
      doc.type === 'inventory'
        ? doc.lines
            .filter((l) => l.materialId && l.lotId)
            .map((l) => {
              const book = Number(l.bookQuantity ?? 0);
              const actual = Number(l.actualQuantity ?? l.quantity ?? 0);
              return {
                ...l,
                bookQuantity: book,
                actualQuantity: actual,
                quantity: actual,
              };
            })
        : doc.lines.filter((l) => l.materialId && l.lotId && l.quantity > 0),
  });

  const persistDraft = async (doc: StockDocument): Promise<StockDocument> => {
    const body = buildBody(doc);
    if (doc.id) {
      return api.updateDocument(documentType, doc.id, body);
    }
    return api.createDocument(documentType, body);
  };

  const reloadEditingDoc = async (id: string) => api.getDocument(documentType, id);

  const saveDraft = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!editing || !canEditFields) return;
    if (!currentUserId) {
      openLogin();
      return;
    }
    setBusy(true);
    setError('');
    try {
      const saved = await persistDraft(editing);
      applySavedDoc(saved, 'edit');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const runRepost = async () => {
    if (!editing?.id || !currentUserId) {
      openLogin();
      return;
    }
    if (!canRunDocumentActions(permissions, objectId)) return;
    setBusy(true);
    setError('');
    try {
      const body = buildBody(editing);
      await api.repostDocument(documentType, editing.id, currentUserId, body);
      const fresh = await reloadEditingDoc(editing.id);
      applySavedDoc(fresh, formModeAfterPost(fresh));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const runAction = async (action: 'cancel' | 'fulfill', doc: StockDocument) => {
    if (!currentUserId) {
      openLogin();
      return;
    }
    if (!canRunDocumentActions(permissions, objectId)) return;
    setBusy(true);
    setError('');
    try {
      if (action === 'cancel') await api.cancelDocument(documentType, doc.id, currentUserId);
      if (action === 'fulfill') await api.fulfillDocument(documentType, doc.id, currentUserId);
      const fresh = await reloadEditingDoc(doc.id);
      applySavedDoc(fresh, 'view');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleMenuAction = async (actionId: string) => {
    if (!editing) return;
    if (actionId === 'save') {
      await saveDraft();
      return;
    }
    if (actionId === 'post') {
      if (!currentUserId) {
        openLogin();
        return;
      }
      if (!canRunDocumentActions(permissions, objectId)) return;
      setBusy(true);
      setError('');
      try {
        let docId = editing.id;
        if (canEditFields) {
          const saved = await persistDraft(editing);
          applySavedDoc(saved, 'edit');
          docId = saved.id;
          await load();
        }
        if (!docId) throw new Error('Сначала сохраните документ');
        const posted = await api.postDocument(documentType, docId, currentUserId);
        const fresh = await reloadEditingDoc(docId);
        applySavedDoc(fresh, formModeAfterPost(fresh));
        if (documentType === 'inventory') {
          const parts: string[] = [];
          if (posted.linkedWriteoffId || fresh.linkedWriteoffId) {
            parts.push('черновик списания');
          }
          if (posted.linkedPostingId || fresh.linkedPostingId) {
            parts.push('черновик оприходования');
          }
          setPostInfo(
            parts.length
              ? `Инвентаризация проведена. Созданы: ${parts.join(' и ')}. Проведите их отдельно — остатки меняются только ими.`
              : 'Инвентаризация проведена. Расхождений нет — связанные документы не созданы.'
          );
        }
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
      return;
    }
    if (actionId === 'repost') {
      await runRepost();
      return;
    }
    if (actionId === 'cancel' && editing.id) {
      await runAction('cancel', editing);
    }
    if (actionId === 'fulfill' && editing.id) {
      await runAction('fulfill', editing);
    }
  };

  const meta = editing ? typeMeta : null;

  const warehouseFields = useMemo(() => {
    if (!meta || !editing) return null;
    const ro = !canEditFields;

    if (meta.warehouseMode === 'single') {
      return (
        <label>
          Склад
          {ro ? (
            <span className="readonly-field">{editing.warehouseId ? whName(editing.warehouseId) : '—'}</span>
          ) : (
            <SearchableSelect
              value={editing.warehouseId || ''}
              onChange={(v) => {
                if (editing.type === 'inventory') {
                  void applyInventoryWarehouse(v, true);
                  return;
                }
                setEditing((d) => (d ? { ...d, warehouseId: v } : d));
              }}
              options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
            />
          )}
        </label>
      );
    }
    if (meta.warehouseMode === 'to') {
      return (
        <label>
          Склад (куда)
          {ro ? (
            <span className="readonly-field">{editing.warehouseToId ? whName(editing.warehouseToId) : '—'}</span>
          ) : (
            <SearchableSelect
              value={editing.warehouseToId || ''}
              onChange={(v) => setEditing((d) => (d ? { ...d, warehouseToId: v } : d))}
              options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
            />
          )}
        </label>
      );
    }
    if (meta.warehouseMode === 'from') {
      return (
        <label>
          Склад (откуда)
          {ro ? (
            <span className="readonly-field">{editing.warehouseFromId ? whName(editing.warehouseFromId) : '—'}</span>
          ) : (
            <SearchableSelect
              value={editing.warehouseFromId || ''}
              onChange={(v) => setEditing((d) => (d ? { ...d, warehouseFromId: v } : d))}
              options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
            />
          )}
        </label>
      );
    }
    return (
      <>
        <label>
          Склад (откуда)
          {ro ? (
            <span className="readonly-field">{editing.warehouseFromId ? whName(editing.warehouseFromId) : '—'}</span>
          ) : (
            <SearchableSelect
              value={editing.warehouseFromId || ''}
              onChange={(v) => setEditing((d) => (d ? { ...d, warehouseFromId: v } : d))}
              options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
            />
          )}
        </label>
        <label>
          Склад (куда)
          {ro ? (
            <span className="readonly-field">{editing.warehouseToId ? whName(editing.warehouseToId) : '—'}</span>
          ) : (
            <SearchableSelect
              value={editing.warehouseToId || ''}
              onChange={(v) => setEditing((d) => (d ? { ...d, warehouseToId: v } : d))}
              options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
            />
          )}
        </label>
      </>
    );
  }, [meta, editing, warehouses, canEditFields]);

  const modalTitle = (() => {
    if (!editing) return '';
    if (formMode === 'create') return `Новый: ${typeMeta?.label}`;
    if (formMode === 'view') return `Просмотр — ${editing.number}`;
    return `Изменение — ${editing.number}`;
  })();

  const docActions = buildDocumentActions(
    editing,
    formMode,
    permissions,
    objectId,
    formMode === 'create'
  );

  const invDiffRows = useMemo(() => {
    if (!editing || editing.type !== 'inventory') return [];
    return editing.lines
      .filter((l) => l.materialId && l.lotId)
      .map((l) => {
        const book = roundQty(Number(l.bookQuantity ?? 0));
        const actual = roundQty(Number(l.actualQuantity ?? l.quantity ?? 0));
        const delta = roundQty(actual - book);
        return { ...l, book, actual, delta };
      })
      .filter((row) => row.delta !== 0);
  }, [editing]);

  const invFactRows = useMemo(() => {
    if (!editing || editing.type !== 'inventory') return [];
    // Факт: все строки документа; fact=0 — валидное значение (недостача = план − 0), строка не скрывается
    return editing.lines.map((l, idx) => ({ line: l, idx }));
  }, [editing]);

  const linesTable = editing ? (
    editing.type === 'inventory' ? (
      <div className="inv-doc-lines">
        <div className="tabs inv-tabs">
          {(
            [
              ['plan', 'План'],
              ['fact', 'Факт'],
              ['diff', 'Разница'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={invTab === id ? 'active' : ''}
              onClick={() => setInvTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="doc-lines-table-wrap">
          {invTab === 'plan' && (
            <table className="data-table doc-lines-table">
              <thead>
                <tr>
                  <th>Материал</th>
                  <th>Партия</th>
                  <th>Учёт (план)</th>
                </tr>
              </thead>
              <tbody>
                {editing.lines
                  .filter((l) => l.materialId && l.lotId && Number(l.bookQuantity ?? 0) > 0)
                  .map((line) => (
                    <tr key={line.id}>
                      <td>{matName(line.materialId)}</td>
                      <td>{lotNum(line.lotId)}</td>
                      <td>{line.bookQuantity ?? 0}</td>
                    </tr>
                  ))}
                {!editing.lines.some((l) => Number(l.bookQuantity ?? 0) > 0) && (
                  <tr>
                    <td colSpan={3} className="muted">
                      Нет остатков на складе — выберите склад или добавьте позиции во вкладке «Факт»
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {invTab === 'fact' && (
            <table className="data-table doc-lines-table">
              <thead>
                <tr>
                  <th>Материал</th>
                  <th>Партия</th>
                  <th>Факт</th>
                  {canEditFields && <th />}
                </tr>
              </thead>
              <tbody>
                {invFactRows.map(({ line, idx }) => (
                  <tr key={line.id}>
                    <td>
                      {canEditFields && Number(line.bookQuantity ?? 0) === 0 ? (
                        <SearchableSelect
                          value={line.materialId}
                          onChange={(v) => {
                            const lines = [...editing.lines];
                            lines[idx] = { ...line, materialId: v, lotId: '' };
                            setEditing({ ...editing, lines });
                          }}
                          options={materials.map((m) => ({ value: m.id, label: m.name }))}
                        />
                      ) : (
                        matName(line.materialId)
                      )}
                    </td>
                    <td>
                      {canEditFields && Number(line.bookQuantity ?? 0) === 0 ? (
                        <SearchableSelect
                          value={line.lotId}
                          onChange={(v) => {
                            const lines = [...editing.lines];
                            lines[idx] = { ...line, lotId: v };
                            setEditing({ ...editing, lines });
                          }}
                          disabled={!line.materialId}
                          options={lotsForMaterial(lots, line.materialId).map((l) => ({
                            value: l.id,
                            label: l.number,
                          }))}
                        />
                      ) : (
                        lotNum(line.lotId)
                      )}
                    </td>
                    <td>
                      {canEditFields ? (
                        <DecimalInput
                          className="doc-qty-input"
                          min={0}
                          value={line.actualQuantity ?? 0}
                          onValueChange={(actual) => {
                            const lines = [...editing.lines];
                            lines[idx] = { ...line, actualQuantity: actual, quantity: actual };
                            setEditing({ ...editing, lines });
                          }}
                        />
                      ) : (
                        line.actualQuantity ?? line.quantity
                      )}
                    </td>
                    {canEditFields && (
                      <td>
                        {Number(line.bookQuantity ?? 0) === 0 ? (
                          <IconButton
                            icon="delete"
                            label="Удалить строку"
                            tone="danger"
                            onClick={() =>
                              setEditing({
                                ...editing,
                                lines: editing.lines.filter((_, i) => i !== idx),
                              })
                            }
                          />
                        ) : null}
                      </td>
                    )}
                  </tr>
                ))}
                {!invFactRows.length && (
                  <tr>
                    <td colSpan={canEditFields ? 4 : 3} className="muted">
                      Нет строк факта
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {invTab === 'diff' && (
            <table className="data-table doc-lines-table">
              <thead>
                <tr>
                  <th>Материал</th>
                  <th>Партия</th>
                  <th>Учёт</th>
                  <th>Факт</th>
                  <th>Разница</th>
                </tr>
              </thead>
              <tbody>
                {invDiffRows.map((row) => (
                  <tr key={row.id || invLineKey(row)}>
                    <td>{matName(row.materialId)}</td>
                    <td>{lotNum(row.lotId)}</td>
                    <td>{formatQty(row.book)}</td>
                    <td>{formatQty(row.actual)}</td>
                    <td className={row.delta > 0 ? 'inv-delta-plus' : 'inv-delta-minus'}>
                      {formatQtyDelta(row.delta)}
                    </td>
                  </tr>
                ))}
                {!invDiffRows.length && (
                  <tr>
                    <td colSpan={5} className="muted">
                      Нет расхождений
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {invTab === 'fact' && canEditFields && (
          <button
            type="button"
            className="secondary"
            onClick={() =>
              setEditing({ ...editing, lines: [...editing.lines, emptyInvFactLine()] })
            }
          >
            + Строка
          </button>
        )}
      </div>
    ) : (
      <div className="doc-lines-table-wrap">
        <table className="data-table doc-lines-table">
          <thead>
            <tr>
              <th>Материал</th>
              <th>Партия</th>
              <th>Количество</th>
              {canEditFields && <th />}
            </tr>
          </thead>
          <tbody>
            {editing.lines.map((line, idx) => (
              <tr key={line.id}>
                <td>
                  {canEditFields ? (
                    <SearchableSelect
                      value={line.materialId}
                      onChange={(v) => {
                        const lines = [...editing.lines];
                        lines[idx] = { ...line, materialId: v, lotId: '' };
                        setEditing({ ...editing, lines });
                      }}
                      options={materials.map((m) => ({ value: m.id, label: m.name }))}
                    />
                  ) : (
                    matName(line.materialId)
                  )}
                </td>
                <td>
                  {canEditFields ? (
                    <SearchableSelect
                      value={line.lotId}
                      onChange={(v) => {
                        const lines = [...editing.lines];
                        lines[idx] = { ...line, lotId: v };
                        setEditing({ ...editing, lines });
                      }}
                      disabled={!line.materialId}
                      options={lotsForMaterial(lots, line.materialId).map((l) => ({
                        value: l.id,
                        label: l.number,
                      }))}
                    />
                  ) : (
                    lotNum(line.lotId)
                  )}
                </td>
                <td>
                  {canEditFields ? (
                    <input
                      type="number"
                      step="any"
                      min={0}
                      value={line.quantity || ''}
                      onChange={(e) => {
                        const lines = [...editing.lines];
                        lines[idx] = { ...line, quantity: Number(e.target.value) };
                        setEditing({ ...editing, lines });
                      }}
                    />
                  ) : (
                    line.quantity
                  )}
                </td>
                {canEditFields && (
                  <td>
                    <IconButton
                      icon="delete"
                      label="Удалить строку"
                      tone="danger"
                      onClick={() =>
                        setEditing({
                          ...editing,
                          lines: editing.lines.filter((_, i) => i !== idx),
                        })
                      }
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {canEditFields && (
          <button
            type="button"
            className="secondary"
            onClick={() => setEditing({ ...editing, lines: [...editing.lines, emptyLine()] })}
          >
            + Строка
          </button>
        )}
      </div>
    )
  ) : null;

  if (!canViewObject(permissions, objectId, loggedIn)) {
    return <AccessDenied title={typeMeta?.label || documentType} />;
  }

  return (
    <div className="page">
      <div className="page-toolbar">
        <PageTitle pageId={`doc_${documentType}`} title={typeMeta?.label || documentType} />
        <div className="toolbar-actions">
          {!user && (
            <p className="hint" style={{ margin: 0 }}>
              Для проведения{' '}
              <button type="button" className="link-btn" onClick={openLogin}>
                войдите
              </button>
            </p>
          )}
          {canCreateObject(permissions, objectId) && loggedIn && (
            <button type="button" onClick={() => startCreate()} disabled={busy}>
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
        {documentType === 'inventory'
          ? 'План заполняется из остатков склада. Проведение INV не меняет склад — создаются черновики списания и/или оприходования по разнице.'
          : typeMeta?.canFulfill
            ? 'Резерв не меняет остатки. Статус «Выполнен» — после списания в производство.'
            : 'Проведение документа изменяет остатки и журнал движений.'}
      </p>

      {error && <p className="error">{error}</p>}
      {postInfo && <p className="hint">{postInfo}</p>}

      <div className="table-wrap">
        <table className="data-table">
          <ListTableHeader columns={listColumns} extraHead={<th>Действия</th>} />
          <tbody>
            {listTable.displayRows.map((doc) => (
              <tr key={doc.id}>
                {listColumns.map((col) => (
                  <td key={col.key}>
                    {col.render ? col.render(doc) : col.getValue(doc)}
                  </td>
                ))}
                <td>
                  <div className="row-actions">
                    {canViewObject(permissions, objectId, loggedIn) && (
                      <IconButton icon="view" label="Просмотр" tone="muted" onClick={() => openView(doc)} />
                    )}
                    {canEditDocumentRecord(permissions, objectId, doc.status) && (
                      <IconButton icon="edit" label="Изменить" onClick={() => openEdit(doc)} />
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!listTable.displayRows.length && (
              <tr>
                <td colSpan={listColumns.length + 1} className="muted">
                  Нет документов по выбранным отборам
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal
          open
          title={modalTitle}
          onClose={closeForm}
          wide
          className="modal-doc"
          headerExtra={
            <>
              <span className="doc-status-cluster">
                {editing.id ? (
                  <IconButton
                    icon="links"
                    label="Движения и связанные объекты"
                    tone="muted"
                    onClick={() => setTraceOpen(true)}
                  />
                ) : null}
                <span className={`doc-status-badge doc-status-${editing.status || 'draft'}`}>
                  {STATUS_LABEL[editing.status] || (formMode === 'create' ? 'Создан' : editing.status)}
                </span>
              </span>
              {docActions.length > 0 && (
                <ActionsMenu
                  items={docActions}
                  onSelect={(id) => {
                    handleMenuAction(id).catch(console.error);
                  }}
                  disabled={busy || !currentUserId}
                />
              )}
              {formMode === 'view' && <span className="doc-status-hint">Только просмотр</span>}
            </>
          }
          footer={
            <button type="button" className="ghost" onClick={closeForm}>
              Закрыть
            </button>
          }
        >
          <form
            id="stock-doc-form"
            onSubmit={(e) => {
              e.preventDefault();
            }}
            className="doc-form"
          >
            <div className="doc-form-scroll">
            {postedEdit && editing.type !== 'inventory' && (
              <p className="doc-form-notice">
                Изменение проведённого документа выполняется через «Провести повторно»: движения будут
                пересчитаны.
              </p>
            )}
            {editing.type === 'inventory' && editing.status === 'posted' && (
              <p className="doc-form-notice">
                Остатки меняют связанные списание/оприходование. Повторное проведение INV недоступно.
                {editing.linkedWriteoffId || editing.linkedPostingId
                  ? ' Связанные документы — во вкладке «Движения и связанные объекты».'
                  : ''}
              </p>
            )}

            <div className="form-grid doc-header-grid">
              {editing.id && (
                <label>
                  Номер
                  <span className="readonly-field">{editing.number}</span>
                </label>
              )}
              <label>
                Дата
                {canEditFields ? (
                  <input
                    type="date"
                    value={editing.date}
                    onChange={(e) => setEditing({ ...editing, date: e.target.value })}
                    required
                  />
                ) : (
                  <span className="readonly-field">{editing.date}</span>
                )}
              </label>
              <label>
                Время
                {canEditFields ? (
                  <input
                    type="time"
                    value={editing.time || ''}
                    onChange={(e) => setEditing({ ...editing, time: e.target.value })}
                    required
                  />
                ) : (
                  <span className="readonly-field">{editing.time || displayDocTime(editing)}</span>
                )}
              </label>
              {editing.postedByUserId && (
                <label>
                  Провёл
                  <span className="readonly-field" title={editing.postedByUserId}>
                    {userLabel(editing.postedByUserId)}
                    {editing.postedAt ? ` · ${timeFromIso(editing.postedAt)}` : ''}
                  </span>
                </label>
              )}
              {warehouseFields}
              {editing.type === 'reservation' && (
                <label>
                  Заказ на производство (id)
                  {canEditFields ? (
                    <input
                      value={editing.productionOrderId || ''}
                      onChange={(e) => setEditing({ ...editing, productionOrderId: e.target.value || null })}
                    />
                  ) : (
                    <span className="readonly-field">{editing.productionOrderId || '—'}</span>
                  )}
                </label>
              )}
            </div>

            {linesTable}
            </div>

            <div className="doc-form-extra">
            <CollapsibleSection title="Дополнительно" defaultOpen={false}>
              <div className="doc-comment-field">
                <label htmlFor="doc-comment">Комментарий</label>
                {canEditFields ? (
                  <textarea
                    id="doc-comment"
                    value={editing.comment || ''}
                    onChange={(e) => setEditing({ ...editing, comment: e.target.value })}
                    rows={4}
                    placeholder="Примечание к документу"
                  />
                ) : (
                  <div className="readonly-field readonly-multiline">{editing.comment || '—'}</div>
                )}
              </div>
            </CollapsibleSection>
            </div>
          </form>
        </Modal>
      )}

      <DocumentTraceModal
        open={traceOpen && Boolean(editing?.id)}
        onClose={() => setTraceOpen(false)}
        heading={`Связи — ${editing?.number || 'документ'}`}
        trace={trace}
        loading={traceLoading}
        materials={materials}
        lots={lots}
        warehouses={warehouses}
      />
    </div>
  );
}
