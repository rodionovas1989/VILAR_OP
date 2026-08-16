import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { canCreateObject, canModifyObject, canViewObject } from '../auth/permissions';
import { useAuth } from '../auth/AuthContext';
import { Material, PlannedSeriesVolume, ProductionOrder, Series, Specification, TechMap, WorkCenter } from '../types';
import AccessDenied from './AccessDenied';
import PageTitle from './PageTitle';
import SearchableSelect from './SearchableSelect';

const PAGE_ID = 'series_planning';
const ACTIVE = new Set(['новый', 'спланирован']);

type PlanLine = {
  key: string;
  seriesId: string;
  quantity: string;
  specificationId: string;
  workCenterId: string;
};

type Props = {
  materials: Material[];
  series: Series[];
  specs: Specification[];
  techMaps: TechMap[];
  workCenters: WorkCenter[];
  plannedVolumes: PlannedSeriesVolume[];
  onDone?: () => void;
};

function newLine(): PlanLine {
  return {
    key: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    seriesId: '',
    quantity: '',
    specificationId: '',
    workCenterId: '',
  };
}

export default function SeriesPlanningPage({
  materials,
  series,
  specs,
  techMaps,
  workCenters,
  plannedVolumes,
  onDone,
}: Props) {
  const { user } = useAuth();
  const canView = canViewObject(user?.permissions, PAGE_ID, Boolean(user));
  const canRun =
    canCreateObject(user?.permissions, PAGE_ID) || canModifyObject(user?.permissions, PAGE_ID);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [lines, setLines] = useState<PlanLine[]>([newLine()]);
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');

  const matName = (id: string) => materials.find((m) => m.id === id)?.name || id;

  const plannedQtyFor = (materialId: string, workCenterId: string) => {
    if (!materialId || !workCenterId) return null;
    const row = plannedVolumes.find((p) => p.materialId === materialId && p.workCenterId === workCenterId);
    return row ? Number(row.quantity) : null;
  };

  const reloadOrders = useCallback(async () => {
    const rows = await api.list<ProductionOrder>('production_orders').catch(() => [] as ProductionOrder[]);
    setOrders(rows);
  }, []);

  useEffect(() => {
    reloadOrders().catch(console.error);
  }, [reloadOrders]);

  const occupiedSeriesIds = useMemo(() => {
    const set = new Set<string>();
    for (const o of orders) {
      if (o.seriesId && ACTIVE.has(o.status || 'новый')) set.add(o.seriesId);
    }
    return set;
  }, [orders]);

  const availableSeries = useMemo(() => {
    return [...series]
      .filter((s) => !occupiedSeriesIds.has(s.id))
      .sort((a, b) => String(a.number).localeCompare(String(b.number), 'ru', { numeric: true }));
  }, [series, occupiedSeriesIds]);

  const defaultsForSeries = (seriesId: string) => {
    const ser = series.find((s) => s.id === seriesId);
    if (!ser) return { specificationId: '', workCenterId: '', quantity: '' };
    const productSpecs = specs.filter((s) => s.productMaterialId === ser.materialId);
    const main =
      productSpecs.find((s) => (s.type || 'Основная') === 'Основная') || productSpecs[0] || null;
    const tm = main?.techMapId ? techMaps.find((t) => t.id === main.techMapId) : null;
    const workCenterId = tm?.workCenterId || '';
    const qty = plannedQtyFor(ser.materialId, workCenterId);
    return {
      specificationId: main?.id || '',
      workCenterId,
      quantity: qty != null && qty > 0 ? String(qty) : '',
    };
  };

  const usedSeriesByLine = useMemo(() => {
    const map = new Map<string, string>(); // seriesId -> line key
    for (const l of lines) {
      if (l.seriesId) map.set(l.seriesId, l.key);
    }
    return map;
  }, [lines]);

  const duplicateSeriesIds = useMemo(() => {
    const counts = new Map<string, number>();
    for (const l of lines) {
      if (!l.seriesId) continue;
      counts.set(l.seriesId, (counts.get(l.seriesId) || 0) + 1);
    }
    return new Set([...counts.entries()].filter(([, n]) => n > 1).map(([id]) => id));
  }, [lines]);

  const specsForLine = (line: PlanLine) => {
    const ser = series.find((s) => s.id === line.seriesId);
    if (!ser) return [] as Specification[];
    return specs.filter((s) => s.productMaterialId === ser.materialId);
  };

  const seriesOptionsForLine = (lineKey: string) => {
    return availableSeries.filter((s) => {
      const owner = usedSeriesByLine.get(s.id);
      return !owner || owner === lineKey;
    });
  };

  const updateLine = (key: string, patch: Partial<PlanLine>) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const onSeriesChange = (key: string, seriesId: string) => {
    if (seriesId) {
      const owner = usedSeriesByLine.get(seriesId);
      if (owner && owner !== key) {
        setError(`Серия уже выбрана в другой строке. Одна серия — одна строка плана.`);
        return;
      }
    }
    setError('');
    updateLine(key, { seriesId, ...defaultsForSeries(seriesId) });
  };

  const onSpecChange = (key: string, specificationId: string) => {
    const line = lines.find((l) => l.key === key);
    const ser = line ? series.find((s) => s.id === line.seriesId) : null;
    const spec = specs.find((s) => s.id === specificationId);
    const tm = spec?.techMapId ? techMaps.find((t) => t.id === spec.techMapId) : null;
    const workCenterId = tm?.workCenterId || line?.workCenterId || '';
    const qty = ser ? plannedQtyFor(ser.materialId, workCenterId) : null;
    updateLine(key, {
      specificationId,
      ...(tm?.workCenterId ? { workCenterId: tm.workCenterId } : {}),
      ...(qty != null && qty > 0 ? { quantity: String(qty) } : {}),
    });
  };

  const onWorkCenterChange = (key: string, workCenterId: string) => {
    const line = lines.find((l) => l.key === key);
    const ser = line ? series.find((s) => s.id === line.seriesId) : null;
    const qty = ser ? plannedQtyFor(ser.materialId, workCenterId) : null;
    updateLine(key, {
      workCenterId,
      ...(qty != null && qty > 0 ? { quantity: String(qty) } : {}),
    });
  };

  const removeLine = (key: string) => {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.key !== key)));
  };

  const pickSeries = () => {
    setError('');
    setOkMsg('');
    if (!availableSeries.length) {
      setError('Нет свободных серий для подбора');
      return;
    }
    const next = availableSeries.map((s) => ({
      key: `${Date.now()}-${Math.random().toString(16).slice(2)}-${s.id}`,
      seriesId: s.id,
      ...defaultsForSeries(s.id),
    }));
    setLines(next);
    setOkMsg(`Подобрано серий: ${next.length}`);
  };

  const submit = async () => {
    setBusy(true);
    setError('');
    setOkMsg('');
    try {
      if (!startDate || !endDate) {
        throw new Error('Укажите начало и окончание периода');
      }
      const filled = lines.filter((l) => l.seriesId);
      if (!filled.length) {
        throw new Error('Добавьте хотя бы одну серию');
      }
      const emptyQty = filled.find((l) => !(Number(l.quantity) > 0));
      if (emptyQty) {
        const ser = series.find((s) => s.id === emptyQty.seriesId);
        throw new Error(`Укажите количество для серии «${ser?.number || emptyQty.seriesId}»`);
      }
      const seen = new Set<string>();
      for (const l of filled) {
        if (seen.has(l.seriesId)) {
          const ser = series.find((s) => s.id === l.seriesId);
          throw new Error(
            `Серия «${ser?.number || l.seriesId}» указана в нескольких строках. Оставьте одну строку на серию.`
          );
        }
        seen.add(l.seriesId);
      }
      if (lines.some((l) => !l.seriesId)) {
        throw new Error('Удалите пустые строки или выберите в них серии');
      }
      const result = await api.planSeries({
        startDate,
        endDate,
        lines: filled.map((l) => ({
          seriesId: l.seriesId,
          quantity: Number(l.quantity),
          specificationId: l.specificationId || undefined,
          workCenterId: l.workCenterId || undefined,
        })),
      });
      setOkMsg(
        `Создано заказов: ${result.count}. Откройте «Заказы на производство» или рабочий стол планирования.`
      );
      setLines([newLine()]);
      await reloadOrders();
      onDone?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!canView) {
    return <AccessDenied title="Планирование серий" />;
  }

  return (
    <div className="page series-plan-page">
      <div className="page-toolbar">
        <PageTitle pageId={PAGE_ID} title="Планирование серий" />
      </div>

      <p className="hint" style={{ marginTop: 0 }}>
        В списке только серии без незакрытого заказа. При выборе серии подставляются основная спецификация, РЦ из
        техкарты и количество из плановых объёмов (продукт × РЦ) — всё можно изменить. Одна серия — одна строка и один
        незакрытый заказ. «Подобрать серии» заполняет таблицу всеми свободными сериями.
      </p>

      {error && <p className="error">{error}</p>}
      {okMsg && <p className="hint">{okMsg}</p>}
      {duplicateSeriesIds.size > 0 && (
        <p className="error">В таблице есть повторяющиеся серии — оставьте по одной строке на каждую.</p>
      )}

      <div className="series-plan-period">
        <label>
          <span>Начало периода</span>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={!canRun} />
        </label>
        <label>
          <span>Окончание</span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} disabled={!canRun} />
        </label>
      </div>

      {!availableSeries.length && (
        <p className="error">
          Нет свободных серий: у всех уже есть заказ «новый» или «спланирован». Создайте новые серии в справочнике
          «Серии».
        </p>
      )}

      <div className="table-wrap">
        <table className="series-plan-table">
          <thead>
            <tr>
              <th>Серия</th>
              <th>Спецификация</th>
              <th>РЦ</th>
              <th>Количество</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const ser = series.find((s) => s.id === line.seriesId);
              const lineSpecs = specsForLine(line);
              const options = seriesOptionsForLine(line.key);
              const isDup = Boolean(line.seriesId && duplicateSeriesIds.has(line.seriesId));
              return (
                <tr key={line.key} className={isDup ? 'series-plan-row-dup' : undefined}>
                  <td>
                    <SearchableSelect
                      value={line.seriesId}
                      disabled={!canRun || busy}
                      onChange={(v) => onSeriesChange(line.key, v)}
                      options={[
                        ...options.map((s) => ({
                          value: s.id,
                          label: `${s.number} — ${matName(s.materialId)}`,
                        })),
                        ...(line.seriesId && !options.some((s) => s.id === line.seriesId) && ser
                          ? [
                              {
                                value: ser.id,
                                label: `${ser.number} — ${matName(ser.materialId)}${
                                  occupiedSeriesIds.has(ser.id)
                                    ? ' (занята заказом)'
                                    : ' (уже в другой строке)'
                                }`,
                              },
                            ]
                          : []),
                      ]}
                    />
                    {isDup && <div className="error">Дубль серии в таблице</div>}
                  </td>
                  <td>
                    <SearchableSelect
                      value={line.specificationId}
                      disabled={!canRun || busy || !line.seriesId}
                      onChange={(v) => onSpecChange(line.key, v)}
                      options={lineSpecs.map((s) => ({
                        value: s.id,
                        label:
                          (s.name || s.id) +
                          ((s.type || 'Основная') !== 'Основная' ? ` (${s.type})` : ''),
                      }))}
                    />
                  </td>
                  <td>
                    <SearchableSelect
                      value={line.workCenterId}
                      disabled={!canRun || busy || !line.seriesId}
                      onChange={(v) => onWorkCenterChange(line.key, v)}
                      options={workCenters.map((w) => ({ value: w.id, label: w.name }))}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={line.quantity}
                      disabled={!canRun || busy}
                      onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="ghost"
                      disabled={!canRun || busy || lines.length <= 1}
                      onClick={() => removeLine(line.key)}
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="toolbar-actions" style={{ marginTop: '0.75rem' }}>
        <button
          type="button"
          className="ghost"
          disabled={!canRun || busy}
          onClick={() => setLines((p) => [...p, newLine()])}
        >
          Добавить строку
        </button>
        <button
          type="button"
          className="ghost"
          disabled={!canRun || busy || !availableSeries.length}
          onClick={pickSeries}
          title="Заполнить таблицу всеми свободными сериями (по одной строке)"
        >
          Подобрать серии
          {availableSeries.length ? ` (${availableSeries.length})` : ''}
        </button>
        <button
          type="button"
          disabled={!canRun || busy || duplicateSeriesIds.size > 0}
          onClick={() => void submit()}
        >
          {busy ? 'Создание…' : 'Создать заказы'}
        </button>
      </div>
    </div>
  );
}
