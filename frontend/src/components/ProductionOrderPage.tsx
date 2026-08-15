import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useListTable, ListColumn } from '../hooks/useListTable';
import { useRecentEntityBridge } from '../hooks/useRecentEntityBridge';
import {
  canCreateObject,
  canModifyObject,
  canViewObject,
} from '../auth/permissions';
import { useAuth } from '../auth/AuthContext';
import { RecentMode, useRecentObjects } from '../auth/RecentObjectsContext';
import {
  Lot,
  Material,
  OrderLine,
  OrderStatus,
  PlannedSeriesVolume,
  ProductionOrder,
  Series,
  Specification,
  Warehouse,
  WorkCenter,
} from '../types';
import { OrderTrace } from '../types.documents';
import AccessDenied from './AccessDenied';
import ActionsMenu, { ActionMenuItem } from './ActionsMenu';
import CollapsibleSection from './CollapsibleSection';
import DocumentTraceModal from './DocumentTraceModal';
import IconButton from './IconButton';
import { Modal } from './Modal';
import PageTitle from './PageTitle';
import RefreshButton from './RefreshButton';
import ListTableHeader from './ListTableHeader';
import { ListViewSettingsButton, ListViewSettingsPanel } from './ListViewSettings';

const OBJECT_ID = 'production_orders';

type Props = {
  materials: Material[];
  series: Series[];
  workCenters: WorkCenter[];
  specs: Specification[];
  plannedVolumes: PlannedSeriesVolume[];
  lots: Lot[];
  warehouses?: Warehouse[];
};

type FormMode = 'create' | 'edit' | 'view';

const STATUS_LABEL: Record<OrderStatus, string> = {
  'новый': 'Новый',
  'спланирован': 'Спланирован',
  'завершен': 'Завершён',
  'отменен': 'Отменён',
};

const STATUS_CLASS: Record<OrderStatus, string> = {
  'новый': 'draft',
  'спланирован': 'posted',
  'завершен': 'fulfilled',
  'отменен': 'cancelled',
};

function toLocalInput(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string) {
  if (!value) return '';
  return new Date(value).toISOString();
}

function emptyOrder(): ProductionOrder {
  return {
    id: '',
    materialId: '',
    seriesId: '',
    workCenterId: '',
    startAt: '',
    endAt: '',
    quantity: 0,
    status: 'новый',
    lines: [],
    actualLines: [],
    specificationId: null,
  };
}

function cloneOrder(order: ProductionOrder): ProductionOrder {
  return {
    ...order,
    lines: order.lines?.map((l) => ({ ...l })) || [],
    actualLines: order.actualLines?.map((l) => ({ ...l })) || [],
  };
}

function buildActions(
  order: ProductionOrder | null,
  formMode: FormMode,
  canCreate: boolean,
  canModify: boolean
): ActionMenuItem[] {
  const items: ActionMenuItem[] = [];
  const status = order?.status || 'новый';
  const canEdit = order
    ? formMode !== 'view' && status === 'новый' && canModify
    : formMode === 'create' && canCreate;

  if (canEdit) items.push({ id: 'save', label: order?.id ? 'Сохранить' : 'Сохранить черновик' });
  if (order?.id && status === 'спланирован' && (order.lines?.length || 0) > 0 && canModify) {
    items.push({ id: 'complete', label: 'Завершить производство' });
  }
  if (order?.id && status !== 'завершен' && status !== 'отменен' && canModify) {
    items.push({ id: 'cancel', label: 'Отменить заказ', danger: true });
  }
  return items;
}

export default function ProductionOrderPage({
  materials,
  series,
  workCenters,
  specs,
  plannedVolumes,
  lots,
  warehouses = [],
}: Props) {
  const { user } = useAuth();
  const { remember, drop } = useRecentObjects();
  const permissions = user?.permissions;
  const loggedIn = Boolean(user);
  const canView = canViewObject(permissions, OBJECT_ID, loggedIn);
  const canCreate = canCreateObject(permissions, OBJECT_ID);
  const canModify = canModifyObject(permissions, OBJECT_ID);

  const [rows, setRows] = useState<ProductionOrder[]>([]);
  const [editing, setEditing] = useState<ProductionOrder | null>(null);
  const [formMode, setFormMode] = useState<FormMode>('create');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [listSettingsOpen, setListSettingsOpen] = useState(false);
  const [trace, setTrace] = useState<OrderTrace | null>(null);
  const [traceLoading, setTraceLoading] = useState(false);
  const [traceOpen, setTraceOpen] = useState(false);

  const matName = (id: string) => materials.find((m) => m.id === id)?.name || id;
  const serNum = (id: string) => series.find((s) => s.id === id)?.number || id;
  const wcName = (id: string) => workCenters.find((w) => w.id === id)?.name || id;
  const lotNum = (id: string) => lots.find((l) => l.id === id)?.number || id;
  const orderLabel = (order: ProductionOrder) =>
    `${matName(order.materialId)} / ${serNum(order.seriesId)}`;

  const plannedQtyFor = (materialId: string, workCenterId: string) => {
    if (!materialId || !workCenterId) return null;
    const row = plannedVolumes.find((p) => p.materialId === materialId && p.workCenterId === workCenterId);
    return row ? Number(row.quantity) : null;
  };

  const listColumns = useMemo((): ListColumn<ProductionOrder>[] => {
    return [
      { key: 'material', label: 'Продукт', getValue: (o) => matName(o.materialId) },
      { key: 'series', label: 'Серия', getValue: (o) => serNum(o.seriesId) },
      { key: 'wc', label: 'РЦ', getValue: (o) => wcName(o.workCenterId) },
      {
        key: 'startAt',
        label: 'Начало',
        getValue: (o) => (o.startAt ? new Date(o.startAt).toLocaleString() : '—'),
      },
      { key: 'quantity', label: 'План', getValue: (o) => String(o.quantity) },
      {
        key: 'actualQuantity',
        label: 'Факт',
        getValue: (o) => (o.actualQuantity != null ? String(o.actualQuantity) : '—'),
      },
      {
        key: 'status',
        label: 'Статус',
        getValue: (o) => STATUS_LABEL[o.status] || o.status,
        render: (o) => (
          <span className={`doc-status-badge doc-status-${STATUS_CLASS[o.status]}`}>
            {STATUS_LABEL[o.status] || o.status}
          </span>
        ),
      },
      { key: 'lines', label: 'Строк', getValue: (o) => String(o.lines?.length || 0) },
    ];
  }, [materials, series, workCenters]);

  const listTable = useListTable(rows, listColumns, {
    persistKey: 'production_orders',
    userId: user?.id,
  });

  const load = async () => {
    setError('');
    try {
      const data = await api.list<ProductionOrder>('production_orders');
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => {
    load().catch(console.error);
  }, []);

  useEffect(() => {
    if (!traceOpen || !editing?.id) return;
    let cancelled = false;
    setTraceLoading(true);
    api
      .getOrderTrace(editing.id)
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
  }, [traceOpen, editing?.id, editing?.status]);

  const canEditFields =
    editing &&
    formMode !== 'view' &&
    editing.status === 'новый' &&
    (formMode === 'create' ? canCreate : canModify);

  const validate = (order: ProductionOrder): string | null => {
    if (!order.materialId) return 'Укажите продукт';
    const ser = series.find((s) => s.id === order.seriesId);
    if (!ser || ser.materialId !== order.materialId) {
      return 'Серия должна относиться к выбранному продукту';
    }
    const spec = specs.find((s) => s.id === order.specificationId);
    if (!spec || spec.productMaterialId !== order.materialId) {
      return 'Спецификация должна относиться к выбранному продукту';
    }
    if (!order.workCenterId) return 'Укажите рабочий центр';
    if (!order.startAt || !order.endAt) return 'Укажите даты начала и окончания';
    if (!(Number(order.quantity) > 0)) return 'Укажите количество';
    return null;
  };

  const buildBody = (order: ProductionOrder) => ({
    materialId: order.materialId,
    seriesId: order.seriesId,
    workCenterId: order.workCenterId,
    startAt: order.startAt,
    endAt: order.endAt,
    quantity: order.quantity,
    status: order.status || 'новый',
    specificationId: order.specificationId,
    lines: order.lines || [],
    actualLines: order.actualLines || [],
    actualQuantity: order.actualQuantity ?? null,
  });

  const closeForm = () => {
    setEditing(null);
    setFormMode('create');
    setTraceOpen(false);
  };

  const startCreate = () => {
    if (!canCreate) return;
    setFormMode('create');
    setEditing(emptyOrder());
  };

  const openView = (order: ProductionOrder) => {
    setFormMode('view');
    setEditing(cloneOrder(order));
    if (order.id) {
      remember({ pageId: OBJECT_ID, entityId: order.id, label: orderLabel(order), mode: 'view' });
    }
  };

  const openEdit = (order: ProductionOrder) => {
    if (order.status !== 'новый' || !canModify) return;
    setFormMode('edit');
    setEditing(cloneOrder(order));
    if (order.id) {
      remember({ pageId: OBJECT_ID, entityId: order.id, label: orderLabel(order), mode: 'edit' });
    }
  };

  const openFromRecent = async (entityId: string, mode: RecentMode) => {
    let order = rows.find((r) => r.id === entityId);
    if (!order) {
      try {
        order = await api.get<ProductionOrder>('production_orders', entityId);
      } catch {
        drop(OBJECT_ID, entityId);
        setError('Заказ не найден или недоступен');
        return;
      }
    }
    if (mode === 'edit' && order.status === 'новый' && canModify) {
      openEdit(order);
      return;
    }
    openView(order);
  };

  useRecentEntityBridge({
    pageId: OBJECT_ID,
    entityId: editing?.id || null,
    formMode,
    openEntity: openFromRecent,
    closeModal: closeForm,
  });

  const persist = async (order: ProductionOrder): Promise<ProductionOrder> => {
    const err = validate(order);
    if (err) throw new Error(err);
    const body = buildBody(order);
    if (order.id) {
      return api.update<ProductionOrder>('production_orders', order.id, body);
    }
    return api.create<ProductionOrder>('production_orders', body);
  };

  const applySaved = (saved: ProductionOrder, mode: FormMode) => {
    setEditing(cloneOrder(saved));
    setFormMode(mode);
    if (saved.id && (mode === 'view' || mode === 'edit')) {
      remember({
        pageId: OBJECT_ID,
        entityId: saved.id,
        label: orderLabel(saved),
        mode,
      });
    }
  };

  const saveOrder = async () => {
    if (!editing || !canEditFields) return;
    setBusy(true);
    setError('');
    try {
      const saved = await persist(editing);
      applySaved(saved, 'edit');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const runComplete = async () => {
    if (!editing?.id) return;
    setBusy(true);
    setError('');
    try {
      await api.completeOrder(editing.id, { userId: user?.id });
      const fresh = await api.get<ProductionOrder>('production_orders', editing.id);
      applySaved(fresh, 'view');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const runCancel = async () => {
    if (!editing?.id) return;
    setBusy(true);
    setError('');
    try {
      await api.cancelOrder(editing.id, user?.id);
      const fresh = await api.get<ProductionOrder>('production_orders', editing.id);
      applySaved(fresh, 'view');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleMenuAction = async (actionId: string) => {
    if (actionId === 'save') {
      await saveOrder();
      return;
    }
    if (actionId === 'complete') {
      await runComplete();
      return;
    }
    if (actionId === 'cancel') {
      await runCancel();
    }
  };

  const productOptions = useMemo(
    () => materials.filter((m) => m.type === 'продукт'),
    [materials]
  );

  const seriesOptions = (materialId: string) =>
    series.filter((s) => !materialId || s.materialId === materialId);

  const specOptions = (materialId: string) =>
    specs.filter((sp) => !materialId || sp.productMaterialId === materialId);

  const modalTitle = (() => {
    if (!editing) return '';
    if (formMode === 'create') return 'Новый заказ на производство';
    if (formMode === 'view') return `Заказ — ${matName(editing.materialId)} / ${serNum(editing.seriesId)}`;
    return `Изменение заказа — ${matName(editing.materialId)}`;
  })();

  const orderActions = buildActions(editing, formMode, canCreate, canModify);
  const statusKey = (editing?.status || 'новый') as OrderStatus;

  if (!canView) {
    return <AccessDenied title="Заказы на производство" />;
  }

  return (
    <div className="page">
      <div className="page-toolbar">
        <PageTitle pageId="production_orders" title="Заказы на производство" />
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
        Заказ не проводит движения напрямую: резервирование и списание выполняются через связанные документы и
        рабочие столы.
      </p>

      {error && !editing && <p className="error">{error}</p>}

      <div className="table-wrap">
        <table className="data-table">
          <ListTableHeader columns={listColumns} extraHead={<th>Действия</th>} />
          <tbody>
            {listTable.displayRows.map((order) => (
              <tr key={order.id}>
                {listColumns.map((col) => (
                  <td key={col.key}>
                    {col.render ? col.render(order) : col.getValue(order)}
                  </td>
                ))}
                <td>
                  <div className="row-actions">
                    <IconButton icon="view" label="Просмотр" tone="muted" onClick={() => openView(order)} />
                    {order.status === 'новый' && canModify && (
                      <IconButton icon="edit" label="Изменить" onClick={() => openEdit(order)} />
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!listTable.displayRows.length && (
              <tr>
                <td colSpan={listColumns.length + 1} className="muted">
                  Нет заказов по выбранным отборам
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
          className="modal-doc modal-order"
          headerExtra={
            <>
              <span className="doc-status-cluster">
                {editing.id ? (
                  <IconButton
                    icon="links"
                    label="Документы, движения, резервы"
                    tone="muted"
                    onClick={() => setTraceOpen(true)}
                  />
                ) : null}
                <span className={`doc-status-badge doc-status-${STATUS_CLASS[statusKey]}`}>
                  {STATUS_LABEL[statusKey] || statusKey}
                </span>
              </span>
              {orderActions.length > 0 && (
                <ActionsMenu
                  items={orderActions}
                  onSelect={(id) => {
                    handleMenuAction(id).catch(console.error);
                  }}
                  disabled={busy}
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
          {error && <p className="error">{error}</p>}

          <form
            className="doc-form"
            onSubmit={(e) => {
              e.preventDefault();
            }}
          >
            <div className="doc-form-scroll">
            <div className="form-grid doc-header-grid">
              <label>
                Продукт
                {canEditFields ? (
                  <select
                    value={editing.materialId}
                    onChange={(e) => {
                      const materialId = e.target.value;
                      const patch: Partial<ProductionOrder> = {
                        materialId,
                        seriesId: '',
                        specificationId: null,
                      };
                      const qty = plannedQtyFor(materialId, editing.workCenterId);
                      if (qty != null) patch.quantity = qty;
                      setEditing({ ...editing, ...patch });
                    }}
                    required
                  >
                    <option value="">—</option>
                    {productOptions.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="readonly-field">{matName(editing.materialId)}</span>
                )}
              </label>

              <label>
                Серия
                {canEditFields ? (
                  <select
                    value={editing.seriesId}
                    onChange={(e) => setEditing({ ...editing, seriesId: e.target.value })}
                    required
                    disabled={!editing.materialId}
                  >
                    <option value="">—</option>
                    {seriesOptions(editing.materialId).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.number}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="readonly-field">{serNum(editing.seriesId)}</span>
                )}
              </label>

              <label>
                Спецификация
                {canEditFields ? (
                  <select
                    value={editing.specificationId || ''}
                    onChange={(e) => setEditing({ ...editing, specificationId: e.target.value || null })}
                    required
                    disabled={!editing.materialId}
                  >
                    <option value="">—</option>
                    {specOptions(editing.materialId).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name || s.id}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="readonly-field">
                    {specs.find((s) => s.id === editing.specificationId)?.name || editing.specificationId || '—'}
                  </span>
                )}
              </label>

              <label>
                Рабочий центр
                {canEditFields ? (
                  <select
                    value={editing.workCenterId}
                    onChange={(e) => {
                      const workCenterId = e.target.value;
                      const qty = plannedQtyFor(editing.materialId, workCenterId);
                      setEditing({
                        ...editing,
                        workCenterId,
                        ...(qty != null ? { quantity: qty } : {}),
                      });
                    }}
                    required
                  >
                    <option value="">—</option>
                    {workCenters.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="readonly-field">{wcName(editing.workCenterId)}</span>
                )}
              </label>

              <label>
                Начало
                {canEditFields ? (
                  <input
                    type="datetime-local"
                    value={toLocalInput(editing.startAt)}
                    onChange={(e) => setEditing({ ...editing, startAt: fromLocalInput(e.target.value) })}
                    required
                  />
                ) : (
                  <span className="readonly-field">
                    {editing.startAt ? new Date(editing.startAt).toLocaleString() : '—'}
                  </span>
                )}
              </label>

              <label>
                Окончание
                {canEditFields ? (
                  <input
                    type="datetime-local"
                    value={toLocalInput(editing.endAt)}
                    onChange={(e) => setEditing({ ...editing, endAt: fromLocalInput(e.target.value) })}
                    required
                  />
                ) : (
                  <span className="readonly-field">
                    {editing.endAt ? new Date(editing.endAt).toLocaleString() : '—'}
                  </span>
                )}
              </label>

              <label>
                Количество (план)
                {canEditFields ? (
                  <input
                    type="number"
                    step="any"
                    min={0}
                    value={editing.quantity || ''}
                    onChange={(e) => setEditing({ ...editing, quantity: Number(e.target.value) })}
                    required
                  />
                ) : (
                  <span className="readonly-field">{editing.quantity}</span>
                )}
              </label>

              {editing.actualQuantity != null && (
                <label>
                  Количество (факт)
                  <span className="readonly-field">{editing.actualQuantity}</span>
                </label>
              )}
            </div>

            {(editing.lines?.length || 0) > 0 && (
              <CollapsibleSection title="Подбор сырья (план)" defaultOpen>
                <div className="doc-lines-table-wrap">
                  <table className="data-table doc-lines-table">
                    <thead>
                      <tr>
                        <th>Материал</th>
                        <th>Партия</th>
                        <th>Количество</th>
                      </tr>
                    </thead>
                    <tbody>
                      {editing.lines.map((line: OrderLine, idx) => (
                        <tr key={`${line.materialId}-${line.lotId}-${idx}`}>
                          <td>{matName(line.materialId)}</td>
                          <td>{lotNum(line.lotId)}</td>
                          <td>{line.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CollapsibleSection>
            )}
            </div>

            <div className="doc-form-extra">
            <CollapsibleSection title="Дополнительно" defaultOpen={false}>
              <p className="hint" style={{ margin: 0 }}>
                Статус «Завершён» — списание сырья, приход ГП и снятие резервов через API планирования. «Отменён» —
                только снятие резервов. Подбор сырья выполняется на рабочем столе планирования.
              </p>
            </CollapsibleSection>
            </div>
          </form>
        </Modal>
      )}

      <DocumentTraceModal
        open={traceOpen && Boolean(editing?.id)}
        onClose={() => setTraceOpen(false)}
        heading="Документы, движения и резервы"
        trace={trace}
        loading={traceLoading}
        materials={materials}
        lots={lots}
        warehouses={warehouses}
      />
    </div>
  );
}
