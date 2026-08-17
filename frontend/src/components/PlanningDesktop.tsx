import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { api, GanttTask, MaterialBalanceMatrix } from '../api';
import { MaterialPick, ProductionOrder } from '../types';
import CounterpartyBadge from './CounterpartyBadge';
import GanttChart from './GanttChart';
import PageTitle from './PageTitle';
import SearchableSelect from './SearchableSelect';
import { useAuth } from '../auth/AuthContext';
import { PARAM_ASSAY, PARAM_DRY, LEGACY_PARAM_DRY, computeLineNeed, lotRecalcValue } from '../utils/lotRecalc';

type SuggestResult = {
  orderId: string;
  algorithm: string;
  picks: MaterialPick[];
  warnings: { message: string; materialName?: string }[];
};

type TabId = 'orders' | 'materials' | 'gantt' | 'planned' | 'matrix';

type AvailableLot = {
  id: string;
  number: string;
  freeQty: number;
  counterpartyId?: string;
  counterparty?: { name: string };
  expiryDate: string;
  qualityPermission?: string;
  qualityPermissionLabel?: string;
  qualityName?: string | null;
  qualityMessage?: string | null;
  qualityAllowed?: boolean;
  paramValues?: Record<string, number>;
  characteristicValues?: Record<string, number>;
};

function applyNeedToPick(pick: MaterialPick, lot: AvailableLot | null | undefined, orderQty: number): MaterialPick {
  const need = computeLineNeed({
    qtyPerUnit: Number(pick.qtyPerUnit) || 0,
    orderQty,
    recalcMethod: pick.recalcMethod,
    recalcXLabel: pick.recalcXLabel,
    assay: lotRecalcValue(lot?.characteristicValues || lot?.paramValues, PARAM_ASSAY),
    lossOnDrying: lotRecalcValue(
      lot?.characteristicValues || lot?.paramValues,
      PARAM_DRY,
      LEGACY_PARAM_DRY
    ),
    useAssay: pick.recalcUseAssay,
    useLod: pick.recalcUseLod,
  });
  return {
    ...pick,
    quantity: need.quantity,
    nominalQuantity: need.nominal,
    recalcApplied: need.applied,
    recalcMissing: need.missing,
  };
}

type Props = {
  dictionaries: {
    materials: { id: string; name: string; type?: string }[];
    series: { id: string; number: string }[];
    workCenters: { id: string; name: string }[];
    lots: { id: string; number: string; materialId: string; counterpartyId?: string | null }[];
    counterparties: { id: string; name: string }[];
    specifications: {
      id: string;
      approvedSuppliers: { materialId: string; counterpartyId: string }[];
    }[];
  };
};

export default function PlanningDesktop({ dictionaries }: Props) {
  const { user } = useAuth();
  const [tab, setTab] = useState<TabId>('orders');
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [selectedNew, setSelectedNew] = useState<Set<string>>(new Set());
  const [plannedIds, setPlannedIds] = useState<string[]>([]);
  const [algorithm, setAlgorithm] = useState<'FEFO' | 'FIFO'>('FEFO');
  const [suggestions, setSuggestions] = useState<SuggestResult[]>([]);
  const [message, setMessage] = useState('');
  const [ganttTasks, setGanttTasks] = useState<GanttTask[]>([]);
  const [busy, setBusy] = useState(false);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [matrix, setMatrix] = useState<MaterialBalanceMatrix | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number; lines: string[] } | null>(null);
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterProductIds, setFilterProductIds] = useState<Set<string>>(new Set());
  const [selectedPlanned, setSelectedPlanned] = useState<Set<string>>(new Set());
  const [exportBusy, setExportBusy] = useState(false);
  const [productFilterOpen, setProductFilterOpen] = useState(false);

  const nameOf = (id: string, list: { id: string; name?: string; number?: string }[]) =>
    list.find((x) => x.id === id)?.name || list.find((x) => x.id === id)?.number || id;

  const lotCounterparty = (lotId: string) => {
    const lot = dictionaries.lots.find((l) => l.id === lotId);
    if (!lot?.counterpartyId) return '—';
    return dictionaries.counterparties.find((c) => c.id === lot.counterpartyId)?.name || '—';
  };

  const isSupplierApproved = (
    specificationId: string | null | undefined,
    materialId: string,
    counterpartyId: string | null | undefined
  ) => {
    if (!specificationId || !counterpartyId) return false;
    const spec = dictionaries.specifications.find((s) => s.id === specificationId);
    if (!spec?.approvedSuppliers?.length) return false;
    return spec.approvedSuppliers.some(
      (a) => a.materialId === materialId && a.counterpartyId === counterpartyId
    );
  };

  const counterpartyBadgeHtml = (name: string, approved: boolean) =>
    `<span class="cp-badge ${approved ? 'cp-approved' : 'cp-unapproved'}">${name}</span>`;

  const loadOrders = async () => {
    const data = await api.list<ProductionOrder>('production_orders');
    setOrders(data);
  };

  const loadGantt = async () => {
    try {
      const data = await api.gantt();
      setGanttTasks(data.tasks || []);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
      setGanttTasks([]);
    }
  };

  const loadMatrix = async () => {
    const data = await api.materialBalanceMatrix();
    setMatrix(data);
  };

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    if (tab === 'orders' || tab === 'planned') loadOrders();
    if (tab === 'gantt') loadGantt();
    if (tab === 'matrix') loadMatrix().catch((e) => setMessage(e instanceof Error ? e.message : String(e)));
  }, [tab]);

  const newOrders = useMemo(
    () =>
      orders
        .filter((o) => o.status === 'новый' || !o.status)
        .sort((a, b) => String(b.startAt).localeCompare(String(a.startAt))),
    [orders]
  );

  const allNewSelected = newOrders.length > 0 && newOrders.every((o) => selectedNew.has(o.id));

  const trackedOrders = useMemo(
    () =>
      orders
        .filter((o) => o.status === 'спланирован' || o.status === 'завершен')
        .sort((a, b) => String(a.startAt).localeCompare(String(b.startAt))),
    [orders]
  );

  const productOptions = useMemo(() => {
    const ids = new Set(trackedOrders.map((o) => o.materialId));
    return dictionaries.materials
      .filter((m) => ids.has(m.id) || m.type === 'продукт')
      .filter((m, i, arr) => arr.findIndex((x) => x.id === m.id) === i)
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }, [trackedOrders, dictionaries.materials]);

  const filteredTrackedOrders = useMemo(() => {
    return trackedOrders.filter((o) => {
      const day = String(o.startAt).slice(0, 10);
      if (filterDateFrom && day < filterDateFrom) return false;
      if (filterDateTo && day > filterDateTo) return false;
      if (filterProductIds.size && !filterProductIds.has(o.materialId)) return false;
      return true;
    });
  }, [trackedOrders, filterDateFrom, filterDateTo, filterProductIds]);

  const allFilteredSelected =
    filteredTrackedOrders.length > 0 && filteredTrackedOrders.every((o) => selectedPlanned.has(o.id));

  const selectedFilteredOrders = useMemo(
    () => filteredTrackedOrders.filter((o) => selectedPlanned.has(o.id)),
    [filteredTrackedOrders, selectedPlanned]
  );

  const printSelectedOrders = () => {
    if (!selectedFilteredOrders.length) {
      setMessage('Выберите заказы для печати');
      return;
    }

    const pages = selectedFilteredOrders
      .map((o, idx) => {
        const product = nameOf(o.materialId, dictionaries.materials);
        const seriesNum = nameOf(o.seriesId, dictionaries.series);
        const wc = nameOf(o.workCenterId, dictionaries.workCenters);
        const start = new Date(o.startAt).toLocaleString('ru-RU');
        const end = new Date(o.endAt).toLocaleString('ru-RU');
        const lines = o.lines || [];
        const body =
          lines.length > 0
            ? lines
                .map((line) => {
                  const lot = dictionaries.lots.find((l) => l.id === line.lotId);
                  const cpName = lotCounterparty(line.lotId);
                  const approved = isSupplierApproved(o.specificationId, line.materialId, lot?.counterpartyId);
                  const cpCell =
                    cpName === '—'
                      ? '—'
                      : counterpartyBadgeHtml(cpName, approved);
                  return `
              <tr>
                <td>${nameOf(line.materialId, dictionaries.materials)}</td>
                <td>${nameOf(line.lotId, dictionaries.lots)}</td>
                <td>${cpCell}</td>
                <td class="num">${line.quantity}</td>
              </tr>`;
                })
                .join('')
            : `<tr><td colspan="4" class="empty">Состав не подобран</td></tr>`;

        const pageBreak = idx < selectedFilteredOrders.length - 1 ? ' page-break' : '';
        return `
        <section class="order-page${pageBreak}">
          <header class="order-head">
            <div class="brand">ВИЛАР — заказ на производство</div>
            <dl class="meta-grid">
              <div><dt>Продукция</dt><dd>${product}</dd></div>
              <div><dt>Рабочий центр</dt><dd>${wc}</dd></div>
              <div><dt>Серия</dt><dd>${seriesNum}</dd></div>
              <div><dt>Количество</dt><dd>${o.quantity}</dd></div>
              <div><dt>Начало</dt><dd>${start}</dd></div>
              <div><dt>Окончание</dt><dd>${end}</dd></div>
            </dl>
          </header>
          <h2>Состав</h2>
          <table>
            <thead>
              <tr>
                <th>Материал</th>
                <th>Партия</th>
                <th>Контрагент</th>
                <th class="num">Количество</th>
              </tr>
            </thead>
            <tbody>${body}</tbody>
          </table>
        </section>`;
      })
      .join('');

    const html = `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"/>
      <title>Заказы на производство — печать</title>
      <style>
        *{box-sizing:border-box}
        body{font-family:Segoe UI,sans-serif;font-size:12px;color:#132033;margin:0;padding:16px}
        .order-page{padding:8px 4px 24px}
        .page-break{page-break-after:always;break-after:page}
        .brand{font-size:14px;font-weight:700;letter-spacing:.04em;margin-bottom:12px}
        .meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 24px;margin:0 0 18px;padding:12px 14px;border:1px solid #d5dee7;border-radius:8px;background:#f7fafc}
        .meta-grid dt{margin:0;font-size:11px;color:#5b6b7c;text-transform:uppercase;letter-spacing:.04em}
        .meta-grid dd{margin:2px 0 0;font-size:13px;font-weight:600}
        h2{font-size:14px;margin:0 0 8px}
        table{width:100%;border-collapse:collapse}
        th,td{border:1px solid #d5dee7;padding:7px 8px;text-align:left;vertical-align:top}
        th{background:#eef3f7}
        td.num,th.num{text-align:right;font-variant-numeric:tabular-nums}
        td.empty{color:#5b6b7c;text-align:center}
        .cp-badge{display:inline-block;padding:3px 10px;border-radius:999px;font-weight:600;font-size:11px}
        .cp-approved{background:#c8e6c9;color:#1b5e20}
        .cp-unapproved{background:#ffe082;color:#6d4c00}
        @media print{
          body{padding:0}
          .order-page{padding:0}
        }
      </style></head><body>
      ${pages}
      <script>window.onload=function(){window.print()}</script>
      </body></html>`;

    const w = window.open('', '_blank');
    if (!w) {
      setMessage('Разрешите всплывающие окна для печати');
      return;
    }
    w.document.write(html);
    w.document.close();
  };

  const exportSelectedExcel = async () => {
    if (!selectedFilteredOrders.length) {
      setMessage('Выберите заказы для выгрузки');
      return;
    }
    setExportBusy(true);
    setMessage('');
    try {
      await api.exportOrdersMaterialsXlsx(selectedFilteredOrders.map((o) => o.id));
      setMessage(`Выгружено в Excel: ${selectedFilteredOrders.length} заказ(ов)`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setExportBusy(false);
    }
  };

  const runSuggest = async (orderIds?: string[]) => {
    setBusy(true);
    setMessage('');
    try {
      const ids =
        orderIds && orderIds.length > 0
          ? orderIds
          : plannedIds.length > 0
            ? plannedIds
            : orders
                .filter((o) => o.status === 'новый' || (o.status === 'спланирован' && (!o.lines || o.lines.length === 0)))
                .map((o) => o.id);
      if (!ids.length) {
        setMessage('Нет заказов для подбора сырья. Сначала выберите заказы на вкладке 1.');
        setSuggestions([]);
        return;
      }
      const res = recomputeSuggestionOk((await api.suggestMaterialsBulk(ids, algorithm)) as SuggestResult[]);
      setSuggestions(res);
      setPlannedIds(ids);
      const bad = res.flatMap((r) => r.picks).filter((p) => !p.ok).length;
      const warns = res.flatMap((r) => r.warnings || []).length;
      if (bad) {
        setMessage(`Подбор выполнен: проблемных строк ${bad} (красные ✗). Исправьте партии перед подтверждением.`);
      } else if (warns) {
        setMessage(`Подбор выполнен, предупреждений: ${warns}`);
      } else {
        setMessage('Подбор выполнен успешно');
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const confirmOrders = async () => {
    const ids = [...selectedNew];
    if (!ids.length) return;
    setBusy(true);
    setMessage('');
    try {
      await api.selectOrders(ids);
      // Сброс предыдущего подбора (резерв ещё не создан) и пересборка по новому выбору
      setSuggestions([]);
      setPlannedIds(ids);
      setTab('materials');
      setMessage(
        `Выбрано заказов: ${ids.length}. Статус «спланирован» будет после подтверждения резерва на вкладке 2.`
      );
      await runSuggest(ids);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  const changeLot = async (orderIdx: number, pickIdx: number, lotId: string) => {
    const next = [...suggestions];
    const orderQty = orders.find((o) => o.id === next[orderIdx].orderId)?.quantity || 0;
    let pick = { ...next[orderIdx].picks[pickIdx], lotId: lotId || null };
    if (!lotId) {
      pick = applyNeedToPick(pick, null, orderQty);
      pick.lotNumber = null;
      pick.freeQty = undefined;
      pick.counterpartyId = undefined;
      pick.counterpartyName = undefined;
      pick.expiryDate = undefined;
      pick.qualityPermission = undefined;
      pick.qualityPermissionLabel = undefined;
      pick.qualityName = undefined;
      pick.qualityMessage = undefined;
      pick.qualityAllowed = undefined;
      pick.ok = false;
    } else {
      const lots = (await api.lotsAvailable(pick.materialId, algorithm)) as AvailableLot[];
      const lot = lots.find((l) => l.id === lotId);
      pick = applyNeedToPick(pick, lot, orderQty);
      pick.lotNumber = lot?.number;
      pick.freeQty = lot?.freeQty;
      pick.counterpartyId = lot?.counterpartyId;
      pick.counterpartyName = lot?.counterparty?.name || '—';
      pick.expiryDate = lot?.expiryDate;
      pick.qualityPermission = lot?.qualityPermission;
      pick.qualityPermissionLabel = lot?.qualityPermissionLabel;
      pick.qualityName = lot?.qualityName;
      pick.qualityMessage = lot?.qualityMessage;
      pick.qualityAllowed = lot?.qualityAllowed;
      pick.ok = !!lot && lot.freeQty >= pick.quantity && lot.qualityAllowed !== false;
    }
    next[orderIdx] = { ...next[orderIdx], picks: next[orderIdx].picks.map((p, i) => (i === pickIdx ? pick : p)) };
    setSuggestions(recomputeSuggestionOk(next));
  };

  const changeMaterial = async (orderIdx: number, pickIdx: number, materialId: string) => {
    const next = [...suggestions];
    const prev = next[orderIdx].picks[pickIdx];
    const orderQty = orders.find((o) => o.id === next[orderIdx].orderId)?.quantity || 0;
    const specMaterialId = prev.specMaterialId || prev.materialId;
    const mat = dictionaries.materials.find((m) => m.id === materialId);
    let pick: MaterialPick = applyNeedToPick(
      {
        ...prev,
        materialId,
        materialName: mat?.name || materialId,
        substituted: materialId !== specMaterialId,
        lotId: null,
        lotNumber: null,
        freeQty: undefined,
        counterpartyId: undefined,
        counterpartyName: undefined,
        expiryDate: undefined,
        qualityPermission: undefined,
        qualityPermissionLabel: undefined,
        qualityName: undefined,
        qualityMessage: undefined,
        qualityAllowed: undefined,
        ok: false,
      },
      null,
      orderQty
    );
    try {
      const lots = (await api.lotsAvailable(materialId, algorithm)) as AvailableLot[];
      const ranked = lots.map((lot) => ({ lot, pick: applyNeedToPick(pick, lot, orderQty) }));
      const suitable =
        ranked.find((x) => x.lot.freeQty >= x.pick.quantity && x.lot.qualityAllowed !== false) || ranked[0];
      if (suitable) {
        pick = {
          ...suitable.pick,
          lotId: suitable.lot.id,
          lotNumber: suitable.lot.number,
          freeQty: suitable.lot.freeQty,
          counterpartyId: suitable.lot.counterpartyId,
          counterpartyName: suitable.lot.counterparty?.name || '—',
          expiryDate: suitable.lot.expiryDate,
          qualityPermission: suitable.lot.qualityPermission,
          qualityPermissionLabel: suitable.lot.qualityPermissionLabel,
          qualityName: suitable.lot.qualityName,
          qualityMessage: suitable.lot.qualityMessage,
          qualityAllowed: suitable.lot.qualityAllowed,
          ok: suitable.lot.freeQty >= suitable.pick.quantity && suitable.lot.qualityAllowed !== false,
        };
      }
    } catch {
      /* список партий подгрузится в строке */
    }
    next[orderIdx] = { ...next[orderIdx], picks: next[orderIdx].picks.map((p, i) => (i === pickIdx ? pick : p)) };
    setSuggestions(recomputeSuggestionOk(next));
  };

  const confirmMaterials = async () => {
    setBusy(true);
    setMessage('');
    try {
      const conditionalNotes = suggestions
        .flatMap((s) =>
          s.picks
            .filter((p) => p.lotId && p.qualityPermission === 'conditional')
            .map(
              (p) =>
                `${p.materialName || p.materialId} / ${p.lotNumber || p.lotId}: ${p.qualityMessage || 'Условно годен'}`
            )
        );
      if (conditionalNotes.length) {
        if (
          !confirm(
            `Есть партии «Условно годен» — резерв будет разрешён:\n- ${conditionalNotes.join('\n- ')}\n\nПродолжить?`
          )
        ) {
          setBusy(false);
          return;
        }
      }
      const items = suggestions.map((s) => ({
        orderId: s.orderId,
        picks: s.picks.map((p) => ({
          specLineId: p.specLineId,
          specMaterialId: p.specMaterialId || p.materialId,
          materialId: p.materialId,
          quantity: p.quantity,
          lotId: p.lotId,
        })),
      }));
      await api.confirmMaterialsBulk(items, user?.id);
      setMessage('Созданы документы резервирования. Заказы переведены в статус «спланирован».');
      setPlannedIds([]);
      setSelectedNew(new Set());
      setSuggestions([]);
      await loadOrders();
      setTab('gantt');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const toggleOrder = (id: string) => {
    setExpandedOrders((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const fmtQty = (n: number) =>
    Number.isInteger(n) ? String(n) : n.toLocaleString('ru-RU', { maximumFractionDigits: 4 });

  return (
    <div className="page planning-desktop">
      <PageTitle pageId="planning_desktop" title="Рабочий стол планирования" />
      <div className="tabs">
        <button type="button" className={tab === 'orders' ? 'active' : ''} onClick={() => setTab('orders')}>
          1. Подбор заказов
        </button>
        <button type="button" className={tab === 'materials' ? 'active' : ''} onClick={() => setTab('materials')}>
          2. Подбор сырья
        </button>
        <button type="button" className={tab === 'gantt' ? 'active' : ''} onClick={() => setTab('gantt')}>
          3. Диаграмма Ганта
        </button>
        <button type="button" className={tab === 'planned' ? 'active' : ''} onClick={() => setTab('planned')}>
          4. Заказы и материалы
        </button>
        <button type="button" className={tab === 'matrix' ? 'active' : ''} onClick={() => setTab('matrix')}>
          5. Матрица расходов
        </button>
      </div>
      {message && <div className="alert info">{message}</div>}

      {tab === 'orders' && (
        <div>
          <p className="hint">
            Выберите заказы в статусе «новый». Подтверждение только фиксирует выбор для подбора сырья — статус останется
            «новый», пока на вкладке 2 не будут созданы резервы.
          </p>
          <div className="toolbar-actions" style={{ marginBottom: 12 }}>
            <button type="button" disabled={!selectedNew.size || busy} onClick={confirmOrders}>
              К подбору сырья ({selectedNew.size})
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={allNewSelected}
                      disabled={!newOrders.length}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedNew(new Set(newOrders.map((o) => o.id)));
                        else setSelectedNew(new Set());
                      }}
                      title="Выбрать все"
                    />
                  </th>
                  <th>Продукт</th>
                  <th>Серия</th>
                  <th>РЦ</th>
                  <th>Начало</th>
                  <th>Окончание</th>
                  <th>Кол-во</th>
                </tr>
              </thead>
              <tbody>
                {newOrders.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedNew.has(o.id)}
                        onChange={(e) => {
                          const n = new Set(selectedNew);
                          if (e.target.checked) n.add(o.id);
                          else n.delete(o.id);
                          setSelectedNew(n);
                        }}
                      />
                    </td>
                    <td>{nameOf(o.materialId, dictionaries.materials)}</td>
                    <td>{nameOf(o.seriesId, dictionaries.series)}</td>
                    <td>{nameOf(o.workCenterId, dictionaries.workCenters)}</td>
                    <td>{new Date(o.startAt).toLocaleString()}</td>
                    <td>{new Date(o.endAt).toLocaleString()}</td>
                    <td>{o.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'materials' && (
        <div className="materials-suggest">
          <div className="toolbar-actions" style={{ marginBottom: 12, gap: 12 }}>
            <label>
              Алгоритм{' '}
              <SearchableSelect
                value={algorithm}
                allowEmpty={false}
                onChange={(v) => setAlgorithm(v as 'FEFO' | 'FIFO')}
                options={[
                  { value: 'FEFO', label: 'FEFO' },
                  { value: 'FIFO', label: 'FIFO' },
                ]}
              />
            </label>
            <button type="button" disabled={busy} onClick={() => runSuggest()}>
              Подобрать сырьё
            </button>
            <button
              type="button"
              disabled={!suggestions.length || busy || suggestions.some((s) => s.picks.some((p) => !p.ok))}
              onClick={confirmMaterials}
            >
              Подтвердить резерв
            </button>
          </div>
          <p className="hint">
            GMP: на один компонент в серии — одна партия сырья. Можно вручную заменить партию из списка доступных.
            Если для материала заданы аналоги, можно сменить материал в строке (сначала позиция спецификации, затем
            аналоги). Замена записывается в резерв. Зелёная ✓ — достаточно свободного остатка, красная ✗ — проблема.
            Контрагент: зелёный — одобрен в спецификации, жёлтый — не одобрен.
          </p>
          {suggestions.map((s, oi) => {
            const order = orders.find((o) => o.id === s.orderId);
            const badCount = s.picks.filter((p) => !p.ok).length;
            return (
              <div key={s.orderId} className={`suggest-card${badCount ? ' has-problems' : ''}`}>
                <h3>
                  {order ? nameOf(order.materialId, dictionaries.materials) : s.orderId} · серия{' '}
                  {order ? nameOf(order.seriesId, dictionaries.series) : ''}
                  {badCount ? <span className="suggest-badge-bad"> проблем: {badCount}</span> : null}
                </h3>
                {!!s.warnings?.length && (
                  <ul className="warn-list">
                    {s.warnings.map((w, i) => (
                      <li key={i}>
                        {w.materialName}: {w.message}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="table-wrap suggest-table-wrap">
                  <table className="suggest-table">
                    <colgroup>
                      <col className="col-mat" />
                      <col className="col-qty" />
                      <col className="col-lot" />
                      <col className="col-cp" />
                      <col className="col-exp" />
                      <col className="col-free" />
                      <col className="col-ok" />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>Материал</th>
                        <th className="col-center">Кол-во</th>
                        <th>Партия</th>
                        <th>Контрагент</th>
                        <th className="col-center">Срок годности</th>
                        <th className="col-center">Свободно</th>
                        <th className="col-center">OK</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.picks.map((p, pi) => (
                        <PickRow
                          key={p.specLineId || `${p.materialId}-${pi}`}
                          pick={p}
                          algorithm={algorithm}
                          materials={dictionaries.materials}
                          supplierApproved={isSupplierApproved(
                            order?.specificationId,
                            p.materialId,
                            p.counterpartyId
                          )}
                          onChangeLot={(lotId) => changeLot(oi, pi, lotId)}
                          onChangeMaterial={(materialId) => void changeMaterial(oi, pi, materialId)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'gantt' && <GanttChart tasks={ganttTasks} />}

      {tab === 'planned' && (
        <div>
          <p className="hint">
            Спланированные и завершённые заказы. Отметьте нужные — печать и Excel выводят выбранные заказы с составом.
          </p>
          <div className="planned-filters">
            <label>
              Дата с
              <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} />
            </label>
            <label>
              Дата по
              <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} />
            </label>
            <div className="filter-products">
              <span className="filter-products-label">Продукция</span>
              <ProductCheckboxDropdown
                open={productFilterOpen}
                onOpenChange={setProductFilterOpen}
                options={productOptions}
                selected={filterProductIds}
                onChange={setFilterProductIds}
              />
            </div>
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setFilterDateFrom('');
                setFilterDateTo('');
                setFilterProductIds(new Set());
                setProductFilterOpen(false);
              }}
            >
              Сбросить фильтры
            </button>
          </div>
          <div className="toolbar-actions" style={{ marginBottom: 12 }}>
            <button type="button" className="ghost" onClick={() => setExpandedOrders(new Set())}>
              Свернуть все
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => setExpandedOrders(new Set(filteredTrackedOrders.map((o) => o.id)))}
            >
              Развернуть все
            </button>
            <button
              type="button"
              disabled={!selectedFilteredOrders.length}
              onClick={printSelectedOrders}
            >
              Печать ({selectedFilteredOrders.length})
            </button>
            <button
              type="button"
              disabled={!selectedFilteredOrders.length || exportBusy}
              onClick={exportSelectedExcel}
            >
              Excel ({selectedFilteredOrders.length})
            </button>
          </div>
          <div className="table-wrap">
            <table className="tree-table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      disabled={!filteredTrackedOrders.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedPlanned(new Set(filteredTrackedOrders.map((o) => o.id)));
                        } else {
                          setSelectedPlanned(new Set());
                        }
                      }}
                      title="Выбрать все (по фильтру)"
                    />
                  </th>
                  <th style={{ width: 40 }}></th>
                  <th>Заказ / материал</th>
                  <th>Серия ГП</th>
                  <th>Партия сырья</th>
                  <th>Контрагент</th>
                  <th>Статус</th>
                  <th>Начало</th>
                  <th>Кол-во</th>
                </tr>
              </thead>
              <tbody>
                {filteredTrackedOrders.map((o) => {
                  const open = expandedOrders.has(o.id);
                  const seriesNum = nameOf(o.seriesId, dictionaries.series);
                  return (
                    <Fragment key={o.id}>
                      <tr className="tree-order-row">
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedPlanned.has(o.id)}
                            onChange={(e) => {
                              const n = new Set(selectedPlanned);
                              if (e.target.checked) n.add(o.id);
                              else n.delete(o.id);
                              setSelectedPlanned(n);
                            }}
                          />
                        </td>
                        <td>
                          <button type="button" className="tree-toggle" onClick={() => toggleOrder(o.id)}>
                            {open ? '▾' : '▸'}
                          </button>
                        </td>
                        <td>
                          <strong>{nameOf(o.materialId, dictionaries.materials)}</strong>
                          <span className="muted"> · заказ {o.id.slice(0, 8)}</span>
                        </td>
                        <td>{seriesNum}</td>
                        <td className="muted">{o.lines?.length || 0} парт.</td>
                        <td className="muted">—</td>
                        <td>
                          <span className={`status-pill status-${o.status}`}>{o.status}</span>
                        </td>
                        <td>{new Date(o.startAt).toLocaleString()}</td>
                        <td>{o.quantity}</td>
                      </tr>
                      {open &&
                        (o.lines?.length
                          ? o.lines.map((line, idx) => {
                              const lot = dictionaries.lots.find((l) => l.id === line.lotId);
                              const cpName = lotCounterparty(line.lotId);
                              const approved = isSupplierApproved(
                                o.specificationId,
                                line.materialId,
                                lot?.counterpartyId
                              );
                              return (
                              <tr key={`${o.id}-${line.materialId}-${line.lotId}-${idx}`} className="tree-child-row">
                                <td></td>
                                <td></td>
                                <td className="tree-indent">{nameOf(line.materialId, dictionaries.materials)}</td>
                                <td>{seriesNum}</td>
                                <td>{nameOf(line.lotId, dictionaries.lots)}</td>
                                <td>
                                  {cpName === '—' ? (
                                    '—'
                                  ) : (
                                    <CounterpartyBadge name={cpName} approved={approved} />
                                  )}
                                </td>
                                <td className="muted">компонент</td>
                                <td></td>
                                <td>{line.quantity}</td>
                              </tr>
                              );
                            })
                          : [
                              <tr key={`${o.id}-empty`} className="tree-child-row">
                                <td></td>
                                <td></td>
                                <td className="tree-indent muted" colSpan={7}>
                                  Материалы ещё не подобраны
                                </td>
                              </tr>,
                            ])}
                    </Fragment>
                  );
                })}
                {!filteredTrackedOrders.length && (
                  <tr>
                    <td colSpan={9} className="muted">
                      Нет заказов по выбранным фильтрам
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'matrix' && (
        <div>
          <p className="hint">
            По вертикали — материал, по горизонтали — даты. В ячейке — остаток после расходов дня. Наведите на ячейку с
            расходом, чтобы увидеть заказы.
          </p>
          {!matrix || !matrix.dates.length ? (
            <p className="hint">Нет данных для матрицы (нужны заказы со строками резерва).</p>
          ) : (
            <div className="table-wrap matrix-wrap">
              <table className="matrix-table">
                <thead>
                  <tr>
                    <th className="matrix-sticky">Материал</th>
                    {matrix.dates.map((d) => (
                      <th key={d} className="matrix-date">
                        {d.slice(5)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrix.rows.map((row) => (
                    <tr key={row.materialId}>
                      <td className="matrix-sticky">
                        {row.materialName}
                        {row.unit ? <span className="muted"> ({row.unit})</span> : null}
                      </td>
                      {row.cells.map((cell) => {
                        const hasConsume = cell.consumed > 0;
                        return (
                          <td
                            key={cell.date}
                            className={hasConsume ? 'matrix-cell has-consume' : 'matrix-cell'}
                            onMouseEnter={(e) => {
                              if (!hasConsume) {
                                setTip(null);
                                return;
                              }
                              setTip({
                                x: e.clientX + 12,
                                y: e.clientY + 12,
                                lines: [
                                  `${row.materialName} · ${cell.date}`,
                                  `Расход: ${fmtQty(cell.consumed)} · остаток: ${fmtQty(cell.balance)}`,
                                  ...cell.orders.map((o) => `• ${o.label}: ${fmtQty(o.quantity)}`),
                                ],
                              });
                            }}
                            onMouseMove={(e) => {
                              if (!hasConsume) return;
                              setTip((t) =>
                                t
                                  ? {
                                      ...t,
                                      x: e.clientX + 12,
                                      y: e.clientY + 12,
                                    }
                                  : t
                              );
                            }}
                            onMouseLeave={() => setTip(null)}
                          >
                            {fmtQty(cell.balance)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {tip && (
            <div className="floating-tip" style={{ left: tip.x, top: tip.y }}>
              {tip.lines.map((line, i) => (
                <div key={i} className={i === 0 ? '' : 'tip-res'}>
                  {line}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function recomputeSuggestionOk(suggestions: SuggestResult[]): SuggestResult[] {
  /** Учёт совместного расхода одной партии несколькими заказами в подборе */
  const usedByLot = new Map<string, number>();
  return suggestions.map((s) => ({
    ...s,
    picks: s.picks.map((p) => {
      const lotId = p.lotId || '';
      const baseFree = Number(p.freeQty ?? 0);
      const already = lotId ? usedByLot.get(lotId) || 0 : 0;
      const remain = baseFree - already;
      const qtyOk = !!lotId && remain + 1e-9 >= Number(p.quantity);
      const qualityOk = p.qualityAllowed !== false;
      const ok = qtyOk && qualityOk;
      if (lotId) usedByLot.set(lotId, already + Number(p.quantity || 0));
      return { ...p, ok };
    }),
  }));
}

function ProductCheckboxDropdown({
  open,
  onOpenChange,
  options,
  selected,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: { id: string; name: string }[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) onOpenChange(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onOpenChange]);

  const label =
    selected.size === 0
      ? 'Все продукты'
      : selected.size === 1
        ? options.find((o) => selected.has(o.id))?.name || `Выбрано: 1`
        : `Выбрано: ${selected.size}`;

  const allChecked = options.length > 0 && options.every((o) => selected.has(o.id));

  return (
    <div className={`product-dd${open ? ' open' : ''}`} ref={rootRef}>
      <button type="button" className="product-dd-trigger" onClick={() => onOpenChange(!open)}>
        <span className="product-dd-text">{label}</span>
        <span className="product-dd-caret">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className="product-dd-panel" role="listbox" aria-multiselectable>
          <label className="product-dd-item product-dd-all">
            <input
              type="checkbox"
              checked={allChecked}
              onChange={(e) => {
                if (e.target.checked) onChange(new Set(options.map((o) => o.id)));
                else onChange(new Set());
              }}
            />
            <span>Все продукты</span>
          </label>
          <div className="product-dd-list">
            {options.map((o) => (
              <label key={o.id} className="product-dd-item">
                <input
                  type="checkbox"
                  checked={selected.has(o.id)}
                  onChange={(e) => {
                    const next = new Set(selected);
                    if (e.target.checked) next.add(o.id);
                    else next.delete(o.id);
                    onChange(next);
                  }}
                />
                <span title={o.name}>{o.name}</span>
              </label>
            ))}
            {!options.length && <div className="muted product-dd-empty">Нет продукции в списке</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function formatExpiry(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('ru-RU');
}

function PickRow({
  pick,
  algorithm,
  materials,
  supplierApproved,
  onChangeLot,
  onChangeMaterial,
}: {
  pick: MaterialPick;
  algorithm: string;
  materials: { id: string; name: string }[];
  supplierApproved: boolean;
  onChangeLot: (lotId: string) => void;
  onChangeMaterial: (materialId: string) => void;
}) {
  const [lots, setLots] = useState<
    {
      id: string;
      number: string;
      freeQty: number;
      counterparty?: { name: string };
      expiryDate?: string;
      qualityPermission?: string;
      qualityPermissionLabel?: string;
      qualityName?: string | null;
      qualityMessage?: string | null;
      qualityAllowed?: boolean;
    }[]
  >([]);

  useEffect(() => {
    let cancelled = false;
    api.lotsAvailable(pick.materialId, algorithm).then((data) => {
      if (!cancelled) setLots(data as typeof lots);
    });
    return () => {
      cancelled = true;
    };
  }, [pick.materialId, algorithm]);

  const ok = !!pick.ok;
  const selectedLot = lots.find((l) => l.id === pick.lotId);
  const qualityUnfit = selectedLot?.qualityAllowed === false || pick.qualityAllowed === false;
  const qualityConditional =
    !qualityUnfit &&
    (selectedLot?.qualityPermission === 'conditional' || pick.qualityPermission === 'conditional');
  const qualityMessage = selectedLot?.qualityMessage || pick.qualityMessage;
  const allowedIds = pick.allowedMaterialIds?.length ? pick.allowedMaterialIds : [pick.materialId];
  const canSwap = allowedIds.length > 1;

  return (
    <tr
      className={`${ok && !qualityUnfit ? 'pick-ok' : 'pick-bad'}${qualityUnfit ? ' pick-lot-blocked' : ''}${qualityConditional ? ' pick-lot-conditional' : ''}`}
    >
      <td>
        {canSwap ? (
          <SearchableSelect
            allowEmpty={false}
            value={pick.materialId}
            onChange={onChangeMaterial}
            options={allowedIds.map((id) => ({
              value: id,
              label:
                (materials.find((m) => m.id === id)?.name || id) +
                (id === (pick.specMaterialId || pick.materialId) ? '' : ' (аналог)'),
            }))}
          />
        ) : (
          pick.materialName
        )}
        {pick.substituted && pick.specMaterialName ? (
          <div className="muted">вместо {pick.specMaterialName}</div>
        ) : null}
      </td>
      <td className="col-center num">
        {pick.quantity}
        {pick.recalcApplied ? (
          <div className="pick-recalc-hint">
            пересчёт
            {pick.nominalQuantity != null ? ` (ном. ${pick.nominalQuantity})` : ''}
          </div>
        ) : null}
        {pick.recalcMissing ? (
          <div className="pick-recalc-warn">нет факта в регистре — расход по эталону спецификации</div>
        ) : null}
      </td>
      <td>
        <SearchableSelect
          triggerClassName={[
            ok && !qualityUnfit ? '' : 'select-bad',
            qualityUnfit ? 'select-lot-blocked' : '',
            qualityConditional ? 'select-lot-conditional' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          value={pick.lotId || ''}
          onChange={onChangeLot}
          emptyLabel="— не выбрана —"
          options={lots.map((l) => ({
            value: l.id,
            label: `${
              l.qualityAllowed === false ? '⛔ ' : l.qualityPermission === 'conditional' ? '⚠ ' : ''
            }${l.number} (своб. ${l.freeQty})${l.qualityName ? ` — ${l.qualityName}` : ''}`,
            className: l.qualityAllowed === false ? 'option-lot-blocked' : undefined,
          }))}
        />
        {qualityUnfit && (
          <div className="pick-lot-block-reason">
            {qualityMessage || 'Партия не годна по качеству'}
          </div>
        )}
        {qualityConditional && (
          <div className="pick-lot-conditional-reason">
            {qualityMessage || 'Условно годен — можно брать в работу'}
          </div>
        )}
        {!ok && !qualityUnfit && (
          <div className="pick-problem">
            {!pick.lotId
              ? 'Партия не подобрана'
              : `Недостаточно свободного остатка (нужно ${pick.quantity}, доступно с учётом других заказов)`}
          </div>
        )}
      </td>
      <td>
        {pick.lotId && pick.counterpartyName && pick.counterpartyName !== '—' ? (
          <CounterpartyBadge name={pick.counterpartyName} approved={supplierApproved} />
        ) : (
          '—'
        )}
      </td>
      <td className="col-center">{pick.lotId ? formatExpiry(pick.expiryDate) : '—'}</td>
      <td className="col-center num">{pick.freeQty ?? '—'}</td>
      <td className="ok-cell">
        <span className={ok ? 'ok-mark ok-yes' : 'ok-mark ok-no'} title={ok ? 'OK' : 'Проблема'}>
          {ok ? '✓' : '✗'}
        </span>
      </td>
    </tr>
  );
}
