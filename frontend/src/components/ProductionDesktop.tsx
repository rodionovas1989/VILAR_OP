import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { OrderLine, ProductionOrder, Warehouse, LotCharacteristic } from '../types';
import DecimalInput from './DecimalInput';
import PageTitle from './PageTitle';
import RefreshButton from './RefreshButton';
import SearchableSelect from './SearchableSelect';
import { useAuth } from '../auth/AuthContext';
import { materialHasAssayDryApplication, appliedRecalcTerms, PARAM_ASSAY, PARAM_DRY, LEGACY_PARAM_DRY } from '../utils/lotCharacteristics';
import {
  formatLotNumberLabel,
  lotWhKey,
  parseLotWhKey,
  shortWarehouseLabel,
} from '../utils/lotSelect';

type Dicts = {
  materials: { id: string; name: string; type?: string }[];
  series: { id: string; number: string }[];
  workCenters: { id: string; name: string }[];
  lots: { id: string; number: string; materialId: string; counterpartyId?: string | null }[];
  counterparties: { id: string; name: string }[];
  warehouses: Warehouse[];
  substitutions: {
    id: string;
    baseMaterialId: string;
    bidirectional?: boolean;
    active?: boolean;
    specificationId?: string | null;
    lines?: { materialId: string }[];
  }[];
  specifications: {
    id: string;
    lines?: { id?: string; materialId: string; recalcMethod?: string }[];
  }[];
  characteristics?: LotCharacteristic[];
};

type Props = { dictionaries: Dicts };

type LotOpt = {
  id: string;
  number: string;
  freeQty: number;
  warehouseId?: string;
  warehouseName?: string;
  warehouseType?: string;
  qualityPermission?: string;
  qualityPermissionLabel?: string;
  qualityName?: string | null;
  qualityMessage?: string | null;
  qualityAllowed?: boolean;
  characteristicValues?: Record<string, number>;
};

function nameOf(id: string, list: { id: string; name?: string; number?: string }[]) {
  return list.find((x) => x.id === id)?.name || list.find((x) => x.id === id)?.number || id;
}

function scaleFactLines(planLines: OrderLine[], planQty: number, factQty: number): OrderLine[] {
  const p = Number(planQty) || 0;
  const f = Number(factQty) || 0;
  const copyMeta = (l: OrderLine, quantity: number): OrderLine => ({
    specLineId: l.specLineId,
    specMaterialId: l.specMaterialId || l.materialId,
    materialId: l.materialId,
    lotId: l.lotId,
    warehouseId: l.warehouseId || null,
    quantity,
    substitutionRuleId: l.substitutionRuleId,
  });
  if (!(p > 0) || !(f > 0)) {
    return planLines.map((l) => copyMeta(l, Number(l.quantity)));
  }
  const k = f / p;
  return planLines.map((l) => copyMeta(l, Number((Number(l.quantity) * k).toFixed(6))));
}

function analogMaterialIds(
  specMaterialId: string,
  substitutions: Dicts['substitutions'],
  specificationId?: string | null
): string[] {
  const ids = [specMaterialId];
  for (const rule of substitutions || []) {
    if (rule.active === false) continue;
    if (rule.specificationId && rule.specificationId !== specificationId) continue;
    if (rule.baseMaterialId === specMaterialId) {
      for (const line of rule.lines || []) {
        if (line.materialId) ids.push(line.materialId);
      }
    } else if (rule.bidirectional !== false) {
      if ((rule.lines || []).some((l) => l.materialId === specMaterialId)) {
        ids.push(rule.baseMaterialId);
      }
    }
  }
  return [...new Set(ids.filter(Boolean))];
}

export default function ProductionDesktop({ dictionaries }: Props) {
  const { user } = useAuth();
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<'plan' | 'fact'>('fact');
  const [actualQuantity, setActualQuantity] = useState(0);
  const [actualLines, setActualLines] = useState<OrderLine[]>([]);
  const [lotOptions, setLotOptions] = useState<Record<string, LotOpt[]>>({});
  const [warehouseToId, setWarehouseToId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const defaultWhTo = useMemo(
    () => dictionaries.warehouses.find((w) => w.type === 'ГП')?.id || '',
    [dictionaries.warehouses]
  );

  const load = async () => {
    const data = await api.list<ProductionOrder>('production_orders');
    setOrders(data.filter((o) => o.status === 'спланирован'));
  };

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const planned = useMemo(
    () => [...orders].sort((a, b) => String(a.startAt).localeCompare(String(b.startAt))),
    [orders]
  );

  const selected = planned.find((o) => o.id === selectedId) || null;

  const openOrder = async (order: ProductionOrder) => {
    setSelectedId(order.id);
    setTab('fact');
    setError('');
    setMessage('');
    setWarehouseToId(defaultWhTo);
    const planQty = Number(order.quantity) || 0;
    const factQty =
      order.actualQuantity != null && Number(order.actualQuantity) > 0
        ? Number(order.actualQuantity)
        : planQty;
    const factLines =
      (order.actualLines?.length ?? 0) > 0
        ? (order.actualLines || []).map((l) => ({
            specLineId: l.specLineId,
            specMaterialId: l.specMaterialId || l.materialId,
            materialId: l.materialId,
            lotId: l.lotId,
            warehouseId: l.warehouseId || null,
            quantity: Number(l.quantity),
            substitutionRuleId: l.substitutionRuleId,
          }))
        : scaleFactLines(order.lines || [], planQty, factQty);
    setActualQuantity(factQty);
    setActualLines(factLines);

    const opts: Record<string, LotOpt[]> = {};
    for (const line of factLines) {
      if (opts[line.materialId]) continue;
      try {
        const lots = (await api.lotsAvailable(line.materialId, 'FEFO')) as LotOpt[];
        opts[line.materialId] = lots;
      } catch {
        opts[line.materialId] = [];
      }
    }
    setLotOptions(opts);
    // Склад в строке заказа мог отсутствовать (старые данные) — берём из пары партия×склад.
    setActualLines(
      factLines.map((l) => {
        if (l.warehouseId) return l;
        const hit =
          (opts[l.materialId] || []).find((o) => o.id === l.lotId && o.warehouseId) ||
          (opts[l.materialId] || []).find((o) => o.id === l.lotId);
        return hit?.warehouseId ? { ...l, warehouseId: hit.warehouseId } : l;
      })
    );
  };

  const onFactQtyChange = (value: number) => {
    if (!selected) return;
    setActualQuantity(value);
    const scaled = scaleFactLines(selected.lines || [], Number(selected.quantity), value);
    setActualLines((prev) =>
      scaled.map((s) => {
        const keep = prev.find(
          (p) => (s.specLineId && p.specLineId === s.specLineId) || p.materialId === s.materialId
        );
        return {
          ...s,
          materialId: keep?.materialId || s.materialId,
          lotId: keep?.lotId || s.lotId,
          warehouseId: keep?.warehouseId || s.warehouseId || null,
          quantity: s.quantity,
        };
      })
    );
  };

  const lineKey = (l: OrderLine, idx: number) => l.specLineId || `${l.materialId}-${idx}`;

  const charWarnings = useMemo(() => {
    if (!selected) return [];
    const spec = dictionaries.specifications.find((s) => s.id === selected.specificationId);
    if (!spec) return [];
    const out: string[] = [];
    for (const line of actualLines) {
      const specLine =
        (spec.lines || []).find((l) => l.id && l.id === line.specLineId) ||
        (spec.lines || []).find((l) => l.materialId === (line.specMaterialId || line.materialId));
      if (specLine?.recalcMethod !== 'assay_and_dry') continue;
      const specMat = dictionaries.materials.find((m) => m.id === specLine.materialId);
      const chars = dictionaries.characteristics || [];
      if (!materialHasAssayDryApplication(specMat, chars)) continue;
      const terms = appliedRecalcTerms(specMat, chars);
      const opt = (lotOptions[line.materialId] || []).find((o) => o.id === line.lotId);
      const vals = opt?.characteristicValues || {};
      const assayOk = !terms.useAssay || Number(vals[PARAM_ASSAY]) > 0;
      const lodRaw = vals[PARAM_DRY] ?? vals[LEGACY_PARAM_DRY];
      const lodOk = !terms.useLod || (lodRaw != null && Number.isFinite(Number(lodRaw)) && Number(lodRaw) >= 0 && Number(lodRaw) < 100);
      if (!assayOk || !lodOk) {
        out.push(
          `${nameOf(line.materialId, dictionaries.materials)} / ${nameOf(line.lotId, dictionaries.lots)}: нет факта в регистре характеристик — расход по эталону спецификации`
        );
      }
    }
    return out;
  }, [selected, actualLines, lotOptions, dictionaries.specifications, dictionaries.materials, dictionaries.lots, dictionaries.characteristics]);

  const changeFactLot = (key: string, lotWhValue: string) => {
    const { lotId, warehouseId } = parseLotWhKey(lotWhValue);
    setActualLines((prev) =>
      prev.map((l, idx) => {
        if (lineKey(l, idx) !== key) return l;
        const opts = lotOptions[l.materialId] || [];
        const row = opts.find((o) => o.id === lotId && (!warehouseId || o.warehouseId === warehouseId));
        return {
          ...l,
          lotId,
          warehouseId: row?.warehouseId || warehouseId || l.warehouseId || null,
        };
      })
    );
  };

  const changeFactWarehouse = (key: string, warehouseId: string) => {
    setActualLines((prev) =>
      prev.map((l, idx) => {
        if (lineKey(l, idx) !== key) return l;
        const opts = lotOptions[l.materialId] || [];
        const sameLot = opts.find((o) => o.id === l.lotId && o.warehouseId === warehouseId);
        if (sameLot) return { ...l, warehouseId };
        const onWh =
          opts.find((o) => o.warehouseId === warehouseId && o.qualityAllowed !== false && o.freeQty > 0) ||
          opts.find((o) => o.warehouseId === warehouseId);
        if (onWh) return { ...l, warehouseId, lotId: onWh.id };
        return { ...l, warehouseId: warehouseId || null, lotId: '' };
      })
    );
  };

  const changeFactQty = (key: string, quantity: number) => {
    setActualLines((prev) =>
      prev.map((l, idx) => (lineKey(l, idx) === key ? { ...l, quantity: Number(quantity) } : l))
    );
  };

  const changeFactMaterial = async (key: string, materialId: string) => {
    const specMaterialId =
      actualLines.find((l, idx) => lineKey(l, idx) === key)?.specMaterialId || materialId;
    setActualLines((prev) =>
      prev.map((l, idx) =>
        lineKey(l, idx) === key
          ? {
              ...l,
              materialId,
              specMaterialId: l.specMaterialId || specMaterialId,
              lotId: '',
              warehouseId: null,
              substitutionRuleId: materialId === (l.specMaterialId || specMaterialId) ? null : l.substitutionRuleId,
            }
          : l
      )
    );
    try {
      const lots = (await api.lotsAvailable(materialId, 'FEFO')) as LotOpt[];
      setLotOptions((prev) => ({ ...prev, [materialId]: lots }));
      const suitable = lots.find((o) => o.qualityAllowed !== false && o.freeQty > 0) || lots[0];
      if (suitable) {
        setActualLines((prev) =>
          prev.map((l, idx) =>
            lineKey(l, idx) === key
              ? { ...l, lotId: suitable.id, warehouseId: suitable.warehouseId || null }
              : l
          )
        );
      }
    } catch {
      setLotOptions((prev) => ({ ...prev, [materialId]: [] }));
    }
  };

  const saveFact = async () => {
    if (!selected) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await api.saveProductionFact(selected.id, { actualQuantity, actualLines });
      setMessage('Факт сохранён');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const completeProduction = async () => {
    if (!selected) return;
    const unfit = actualLines
      .map((l) => {
        const opt = (lotOptions[l.materialId] || []).find(
          (o) => o.id === l.lotId && (!l.warehouseId || o.warehouseId === l.warehouseId)
        );
        return opt?.qualityAllowed === false
          ? `${nameOf(l.lotId, dictionaries.lots)}: ${opt.qualityMessage || 'Не годен'}`
          : null;
      })
      .filter(Boolean);
    if (unfit.length) {
      setError(`Нельзя завершить: партии не годны по качеству. ${unfit.join('; ')}`);
      return;
    }
    if (actualLines.some((l) => !l.warehouseId)) {
      setError('Укажите склад списания в каждой строке факта');
      return;
    }
    const conditional = actualLines
      .map((l) => {
        const opt = (lotOptions[l.materialId] || []).find(
          (o) => o.id === l.lotId && (!l.warehouseId || o.warehouseId === l.warehouseId)
        );
        return opt?.qualityPermission === 'conditional'
          ? `${nameOf(l.lotId, dictionaries.lots)}: ${opt.qualityMessage || 'Условно годен'}`
          : null;
      })
      .filter(Boolean);
    const warn =
      conditional.length > 0
        ? `\n\nВнимание (условно годен):\n- ${conditional.join('\n- ')}\n`
        : '';
    if (
      !confirm(
        `Завершить производство по фактическим данным? Будут проведены списания в производство (PRI по складам), выпуск ГП (PRR) и выполнены документы резервирования.${warn}`
      )
    ) {
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await api.saveProductionFact(selected.id, { actualQuantity, actualLines });
      await api.completeOrder(selected.id, {
        userId: user?.id,
        warehouseToId: warehouseToId || undefined,
      });
      setMessage('Производство завершено: PRI + PRR проведены, резерв выполнен');
      setSelectedId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const lotCp = (lotId: string) => {
    const lot = dictionaries.lots.find((l) => l.id === lotId);
    if (!lot?.counterpartyId) return '—';
    return dictionaries.counterparties.find((c) => c.id === lot.counterpartyId)?.name || '—';
  };

  if (selected) {
    const planLines = selected.lines || [];
    return (
      <div className="page production-desktop">
        <div className="page-toolbar">
          <h1>Исполнение заказа</h1>
          <div className="toolbar-actions">
            <button type="button" className="ghost" disabled={busy} onClick={() => setSelectedId(null)}>
              ← К списку
            </button>
            <button type="button" className="ghost" disabled={busy} onClick={saveFact}>
              Сохранить факт
            </button>
            <button type="button" disabled={busy} onClick={completeProduction}>
              Завершить производство
            </button>
          </div>
        </div>
        {error && <div className="alert error">{error}</div>}
        {message && <div className="alert info">{message}</div>}
        {charWarnings.length > 0 && (
          <div className="alert info">
            {charWarnings.map((w) => (
              <div key={w}>{w}</div>
            ))}
          </div>
        )}

        <div className="prod-order-head">
          <div className="prod-head-field">
            <span className="muted">Продукция</span>
            <strong>{nameOf(selected.materialId, dictionaries.materials)}</strong>
          </div>
          <div className="prod-head-field">
            <span className="muted">Серия</span>
            <strong>{nameOf(selected.seriesId, dictionaries.series)}</strong>
          </div>
          <div className="prod-head-field">
            <span className="muted">РЦ</span>
            <strong>{nameOf(selected.workCenterId, dictionaries.workCenters)}</strong>
          </div>
          <div className="prod-head-field">
            <span className="muted">План выпуска</span>
            <strong>{selected.quantity}</strong>
          </div>
          <label className="prod-head-field">
            <span className="muted">Факт выпуска</span>
            <DecimalInput
              min={0}
              value={actualQuantity}
              disabled={busy}
              onValueChange={(value) => onFactQtyChange(value ?? 0)}
            />
          </label>
          <label className="prod-head-field">
            <span className="muted">Склад выпуска (ГП)</span>
            <SearchableSelect
              value={warehouseToId}
              disabled={busy}
              allowEmpty={false}
              onChange={setWarehouseToId}
              options={dictionaries.warehouses.map((w) => ({
                value: w.id,
                label: `${w.name} (${w.type})`,
              }))}
            />
          </label>
        </div>

        <p className="hint">
          При изменении факта выпуска количества компонентов пересчитываются пропорционально плану. Партию и склад
          списания задавайте в строке факта (разные компоненты могут списываться с разных складов). Завершение создаёт
          PRI по каждому складу списания и один PRR на склад выпуска.
        </p>

        <div className="tabs spec-inner-tabs">
          <button type="button" className={tab === 'plan' ? 'active' : ''} onClick={() => setTab('plan')}>
            План
          </button>
          <button type="button" className={tab === 'fact' ? 'active' : ''} onClick={() => setTab('fact')}>
            Факт
          </button>
        </div>

        {tab === 'plan' && (
          <div className="table-wrap">
            <table className="data-table doc-lines-table prod-lines-table">
              <thead>
                <tr>
                  <th>Материал</th>
                  <th>Партия</th>
                  <th>Контрагент</th>
                  <th className="col-center">Количество</th>
                </tr>
              </thead>
              <tbody>
                {planLines.map((l) => (
                  <tr key={`plan-${l.materialId}-${l.lotId}`}>
                    <td>{nameOf(l.materialId, dictionaries.materials)}</td>
                    <td>{nameOf(l.lotId, dictionaries.lots)}</td>
                    <td>{lotCp(l.lotId)}</td>
                    <td className="col-center">{l.quantity}</td>
                  </tr>
                ))}
                {!planLines.length && (
                  <tr>
                    <td colSpan={4} className="muted">
                      Нет планового состава
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'fact' && (
          <div className="table-wrap">
            <table className="data-table doc-lines-table prod-lines-table">
              <thead>
                <tr>
                  <th>Материал</th>
                  <th>Партия</th>
                  <th>Склад</th>
                  <th className="col-center">Свободно</th>
                  <th>Контрагент</th>
                  <th className="col-center">Кол-во</th>
                </tr>
              </thead>
              <tbody>
                {actualLines.map((l, idx) => {
                  const key = lineKey(l, idx);
                  const opts = lotOptions[l.materialId] || [];
                  const selectedOpt =
                    opts.find((o) => o.id === l.lotId && (!l.warehouseId || o.warehouseId === l.warehouseId)) ||
                    opts.find((o) => o.id === l.lotId);
                  const hasCurrent = !!selectedOpt;
                  const unfit = selectedOpt?.qualityAllowed === false;
                  const conditional = selectedOpt?.qualityPermission === 'conditional';
                  const specMat = l.specMaterialId || l.materialId;
                  const allowed = analogMaterialIds(
                    specMat,
                    dictionaries.substitutions || [],
                    selected?.specificationId
                  );
                  const canSwap = allowed.length > 1;
                  const lotSelectValue = l.lotId ? lotWhKey(l.lotId, l.warehouseId || selectedOpt?.warehouseId) : '';
                  return (
                    <tr
                      key={`fact-${key}`}
                      className={unfit ? 'pick-lot-blocked' : conditional ? 'pick-lot-conditional' : undefined}
                    >
                      <td>
                        {canSwap ? (
                          <SearchableSelect
                            allowEmpty={false}
                            value={l.materialId}
                            disabled={busy}
                            onChange={(v) => void changeFactMaterial(key, v)}
                            options={allowed.map((id) => ({
                              value: id,
                              label:
                                nameOf(id, dictionaries.materials) + (id === specMat ? '' : ' (аналог)'),
                            }))}
                          />
                        ) : (
                          nameOf(l.materialId, dictionaries.materials)
                        )}
                        {l.materialId !== specMat ? (
                          <div className="muted">вместо {nameOf(specMat, dictionaries.materials)}</div>
                        ) : null}
                      </td>
                      <td className="prod-lot-cell">
                        <SearchableSelect
                          triggerClassName={[
                            unfit ? 'select-lot-blocked' : '',
                            conditional ? 'select-lot-conditional' : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          value={lotSelectValue}
                          disabled={busy}
                          allowEmpty={false}
                          onChange={(v) => changeFactLot(key, v)}
                          options={[
                            ...(!hasCurrent && l.lotId
                              ? [
                                  {
                                    value: lotWhKey(l.lotId, l.warehouseId),
                                    label: formatLotNumberLabel({
                                      number: nameOf(l.lotId, dictionaries.lots),
                                      warehouseType: dictionaries.warehouses.find(
                                        (w) => w.id === l.warehouseId
                                      )?.type,
                                      warehouseName: dictionaries.warehouses.find(
                                        (w) => w.id === l.warehouseId
                                      )?.name,
                                    }),
                                  },
                                ]
                              : []),
                              ...opts.map((o) => ({
                                value: lotWhKey(o.id, o.warehouseId),
                                label: formatLotNumberLabel(o, false),
                              })),
                          ]}
                        />
                        {selectedOpt?.qualityName && !unfit && !conditional && (
                          <div className="prod-lot-quality muted">{selectedOpt.qualityName}</div>
                        )}
                        {unfit && (
                          <div className="pick-lot-block-reason">
                            {selectedOpt?.qualityMessage || 'Партия не годна по качеству'}
                          </div>
                        )}
                        {conditional && !unfit && (
                          <div className="pick-lot-conditional-reason">
                            {selectedOpt?.qualityMessage ||
                              selectedOpt?.qualityName ||
                              'Условно годен'}
                          </div>
                        )}
                      </td>
                      <td
                        className="prod-wh-cell"
                        title={
                          dictionaries.warehouses.find((x) => x.id === l.warehouseId)?.name || undefined
                        }
                      >
                        <SearchableSelect
                          allowEmpty={false}
                          value={l.warehouseId || ''}
                          disabled={busy}
                          onChange={(v) => changeFactWarehouse(key, v)}
                          options={dictionaries.warehouses.map((w) => ({
                            value: w.id,
                            label: shortWarehouseLabel(w.type, w.name) || w.name,
                          }))}
                          aria-label="Склад списания"
                        />
                      </td>
                      <td className="col-center num prod-free-cell">
                        {selectedOpt?.freeQty != null ? selectedOpt.freeQty : '—'}
                      </td>
                      <td className="prod-cp-cell">{lotCp(l.lotId)}</td>
                      <td className="col-center prod-qty-cell">
                        <DecimalInput
                          min={0}
                          value={l.quantity}
                          disabled={busy}
                          onValueChange={(value) => changeFactQty(key, value ?? 0)}
                        />
                      </td>
                    </tr>
                  );
                })}
                {!actualLines.length && (
                  <tr>
                    <td colSpan={6} className="muted">
                      Нет фактического состава
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="page production-desktop">
      <div className="page-toolbar">
        <PageTitle pageId="production_desktop" title="Управление заказами" />
        <div className="toolbar-actions">
          <RefreshButton onClick={() => load()} />
        </div>
      </div>
      <p className="hint">
        Заказы в статусе «спланирован». Выберите заказ для ввода факта выпуска и завершения производства.
      </p>
      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert info">{message}</div>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Продукт</th>
              <th>Серия</th>
              <th>РЦ</th>
              <th>Начало</th>
              <th>План</th>
              <th>Факт</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {planned.map((o) => (
              <tr key={o.id}>
                <td>{nameOf(o.materialId, dictionaries.materials)}</td>
                <td>{nameOf(o.seriesId, dictionaries.series)}</td>
                <td>{nameOf(o.workCenterId, dictionaries.workCenters)}</td>
                <td>{new Date(o.startAt).toLocaleString('ru-RU')}</td>
                <td>{o.quantity}</td>
                <td>{o.actualQuantity ?? '—'}</td>
                <td>
                  <button type="button" className="ghost" onClick={() => openOrder(o)}>
                    Исполнение
                  </button>
                </td>
              </tr>
            ))}
            {!planned.length && (
              <tr>
                <td colSpan={7} className="muted">
                  Нет спланированных заказов
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
