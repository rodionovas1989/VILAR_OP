import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { OrderLine, ProductionOrder } from '../types';
import IconButton from './IconButton';

type Dicts = {
  materials: { id: string; name: string }[];
  series: { id: string; number: string }[];
  workCenters: { id: string; name: string }[];
  lots: { id: string; number: string; materialId: string; counterpartyId?: string | null }[];
  counterparties: { id: string; name: string }[];
};

type Props = { dictionaries: Dicts };

type LotOpt = { id: string; number: string; freeQty: number };

function nameOf(id: string, list: { id: string; name?: string; number?: string }[]) {
  return list.find((x) => x.id === id)?.name || list.find((x) => x.id === id)?.number || id;
}

function scaleFactLines(planLines: OrderLine[], planQty: number, factQty: number): OrderLine[] {
  const p = Number(planQty) || 0;
  const f = Number(factQty) || 0;
  if (!(p > 0) || !(f > 0)) {
    return planLines.map((l) => ({ materialId: l.materialId, lotId: l.lotId, quantity: Number(l.quantity) }));
  }
  const k = f / p;
  return planLines.map((l) => ({
    materialId: l.materialId,
    lotId: l.lotId,
    quantity: Number((Number(l.quantity) * k).toFixed(6)),
  }));
}

export default function ProductionDesktop({ dictionaries }: Props) {
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<'plan' | 'fact'>('fact');
  const [actualQuantity, setActualQuantity] = useState(0);
  const [actualLines, setActualLines] = useState<OrderLine[]>([]);
  const [lotOptions, setLotOptions] = useState<Record<string, LotOpt[]>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

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
    const planQty = Number(order.quantity) || 0;
    const factQty =
      order.actualQuantity != null && Number(order.actualQuantity) > 0
        ? Number(order.actualQuantity)
        : planQty;
    const factLines =
      (order.actualLines?.length ?? 0) > 0
        ? (order.actualLines || []).map((l) => ({
            materialId: l.materialId,
            lotId: l.lotId,
            quantity: Number(l.quantity),
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
  };

  const onFactQtyChange = (value: number) => {
    if (!selected) return;
    setActualQuantity(value);
    // пересчёт количеств по плану, партии сохраняем текущие (факт)
    const scaled = scaleFactLines(selected.lines || [], Number(selected.quantity), value);
    setActualLines((prev) =>
      scaled.map((s) => {
        const keep = prev.find((p) => p.materialId === s.materialId);
        return {
          materialId: s.materialId,
          lotId: keep?.lotId || s.lotId,
          quantity: s.quantity,
        };
      })
    );
  };

  const changeFactLot = (materialId: string, lotId: string) => {
    setActualLines((prev) => prev.map((l) => (l.materialId === materialId ? { ...l, lotId } : l)));
  };

  const changeFactQty = (materialId: string, quantity: number) => {
    setActualLines((prev) =>
      prev.map((l) => (l.materialId === materialId ? { ...l, quantity: Number(quantity) } : l))
    );
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
    if (!confirm('Завершить производство по фактическим данным? Будут списаны компоненты, оприходована ГП, сняты резервы.')) {
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await api.saveProductionFact(selected.id, { actualQuantity, actualLines });
      await api.completeOrder(selected.id);
      setMessage('Производство завершено: заказ переведён в «завершен», движения проведены');
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

        <div className="prod-order-head">
          <div>
            <div className="muted">Продукция</div>
            <strong>{nameOf(selected.materialId, dictionaries.materials)}</strong>
          </div>
          <div>
            <div className="muted">Серия</div>
            <strong>{nameOf(selected.seriesId, dictionaries.series)}</strong>
          </div>
          <div>
            <div className="muted">РЦ</div>
            <strong>{nameOf(selected.workCenterId, dictionaries.workCenters)}</strong>
          </div>
          <div>
            <div className="muted">План выпуска</div>
            <strong>{selected.quantity}</strong>
          </div>
          <label className="prod-fact-qty">
            <span className="muted">Факт выпуска</span>
            <input
              type="number"
              min={0}
              step="any"
              value={actualQuantity}
              disabled={busy}
              onChange={(e) => onFactQtyChange(Number(e.target.value))}
            />
          </label>
        </div>

        <p className="hint">
          При изменении факта выпуска количества компонентов пересчитываются пропорционально плану. Партии в факте
          можно заменить. Завершение списывает и приходует по факту.
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
            <table>
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
            <table>
              <thead>
                <tr>
                  <th>Материал</th>
                  <th>Партия</th>
                  <th>Контрагент</th>
                  <th className="col-center">Количество</th>
                </tr>
              </thead>
              <tbody>
                {actualLines.map((l) => {
                  const opts = lotOptions[l.materialId] || [];
                  const hasCurrent = opts.some((o) => o.id === l.lotId);
                  return (
                    <tr key={`fact-${l.materialId}`}>
                      <td>{nameOf(l.materialId, dictionaries.materials)}</td>
                      <td>
                        <select
                          value={l.lotId}
                          disabled={busy}
                          onChange={(e) => changeFactLot(l.materialId, e.target.value)}
                        >
                          {!hasCurrent && l.lotId && (
                            <option value={l.lotId}>{nameOf(l.lotId, dictionaries.lots)} (текущая)</option>
                          )}
                          {opts.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.number} (своб. {o.freeQty})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>{lotCp(l.lotId)}</td>
                      <td className="col-center">
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={l.quantity}
                          disabled={busy}
                          onChange={(e) => changeFactQty(l.materialId, Number(e.target.value))}
                          style={{ maxWidth: 120 }}
                        />
                      </td>
                    </tr>
                  );
                })}
                {!actualLines.length && (
                  <tr>
                    <td colSpan={4} className="muted">
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
        <h1>Управление заказами</h1>
        <div className="toolbar-actions">
          <IconButton icon="refresh" label="Обновить" tone="muted" onClick={() => load()} />
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
