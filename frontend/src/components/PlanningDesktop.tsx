import { useEffect, useMemo, useRef, useState } from 'react';
import { api, GanttTask } from '../api';
import { MaterialPick, ProductionOrder } from '../types';
import GanttChart from './GanttChart';

type SuggestResult = {
  orderId: string;
  algorithm: string;
  picks: MaterialPick[];
  warnings: { message: string; materialName?: string }[];
};

type Props = {
  dictionaries: {
    materials: { id: string; name: string }[];
    series: { id: string; number: string }[];
    workCenters: { id: string; name: string }[];
    lots: { id: string; number: string; materialId: string }[];
  };
};

export default function PlanningDesktop({ dictionaries }: Props) {
  const [tab, setTab] = useState<'orders' | 'materials' | 'gantt'>('orders');
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [selectedNew, setSelectedNew] = useState<Set<string>>(new Set());
  const [plannedIds, setPlannedIds] = useState<string[]>([]);
  const [algorithm, setAlgorithm] = useState<'FEFO' | 'FIFO'>('FEFO');
  const [suggestions, setSuggestions] = useState<SuggestResult[]>([]);
  const [message, setMessage] = useState('');
  const [ganttTasks, setGanttTasks] = useState<GanttTask[]>([]);
  const [busy, setBusy] = useState(false);

  const nameOf = (id: string, list: { id: string; name?: string; number?: string }[]) =>
    list.find((x) => x.id === id)?.name || list.find((x) => x.id === id)?.number || id;

  const loadOrders = async () => {
    const data = await api.list<ProductionOrder>('production_orders');
    setOrders(data);
  };

  const loadGantt = async () => {
    const data = await api.gantt();
    setGanttTasks(data.tasks);
  };

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    if (tab === 'gantt') loadGantt();
  }, [tab]);

  const newOrders = useMemo(() => orders.filter((o) => o.status === 'новый'), [orders]);

  const confirmOrders = async () => {
    setBusy(true);
    setMessage('');
    try {
      const ids = [...selectedNew];
      await api.selectOrders(ids);
      setPlannedIds(ids);
      setSelectedNew(new Set());
      await loadOrders();
      setMessage(`Подобрано заказов: ${ids.length}. Перейдите на вкладку «Подбор сырья».`);
      setTab('materials');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const runSuggest = async () => {
    setBusy(true);
    setMessage('');
    try {
      const ids =
        plannedIds.length > 0
          ? plannedIds
          : orders.filter((o) => o.status === 'спланирован' && (!o.lines || o.lines.length === 0)).map((o) => o.id);
      if (!ids.length) {
        setMessage('Нет заказов для подбора сырья. Сначала подберите заказы на вкладке 1.');
        return;
      }
      const res = (await api.suggestMaterialsBulk(ids, algorithm)) as SuggestResult[];
      setSuggestions(res);
      setPlannedIds(ids);
      const warns = res.flatMap((r) => r.warnings || []).length;
      setMessage(warns ? `Подбор выполнен, предупреждений: ${warns}` : 'Подбор выполнен успешно');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const changeLot = async (orderIdx: number, pickIdx: number, lotId: string) => {
    const next = [...suggestions];
    const pick = { ...next[orderIdx].picks[pickIdx], lotId };
    const lots = await api.lotsAvailable(pick.materialId, algorithm);
    const lot = (lots as { id: string; number: string; freeQty: number; counterparty?: { name: string }; expiryDate: string }[]).find(
      (l) => l.id === lotId
    );
    pick.lotNumber = lot?.number;
    pick.freeQty = lot?.freeQty;
    pick.counterpartyName = lot?.counterparty?.name;
    pick.expiryDate = lot?.expiryDate;
    pick.ok = !!lot && lot.freeQty >= pick.quantity;
    next[orderIdx] = { ...next[orderIdx], picks: next[orderIdx].picks.map((p, i) => (i === pickIdx ? pick : p)) };
    setSuggestions(next);
  };

  const confirmMaterials = async () => {
    setBusy(true);
    setMessage('');
    try {
      const items = suggestions.map((s) => ({
        orderId: s.orderId,
        picks: s.picks.map((p) => ({
          materialId: p.materialId,
          quantity: p.quantity,
          lotId: p.lotId,
        })),
      }));
      await api.confirmMaterialsBulk(items);
      setMessage('Резервы созданы, табличные части заказов заполнены.');
      await loadOrders();
      setTab('gantt');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page planning-desktop">
      <div className="page-toolbar">
        <h1>Рабочий стол планирования</h1>
      </div>
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
      </div>
      {message && <div className="alert info">{message}</div>}

      {tab === 'orders' && (
        <div>
          <p className="hint">Выберите заказы в статусе «новый». После подтверждения они перейдут в «спланирован».</p>
          <div className="toolbar-actions" style={{ marginBottom: 12 }}>
            <button type="button" disabled={!selectedNew.size || busy} onClick={confirmOrders}>
              Подтвердить подбор ({selectedNew.size})
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th></th>
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
        <div>
          <div className="toolbar-actions" style={{ marginBottom: 12, gap: 12 }}>
            <label>
              Алгоритм{' '}
              <select value={algorithm} onChange={(e) => setAlgorithm(e.target.value as 'FEFO' | 'FIFO')}>
                <option value="FEFO">FEFO</option>
                <option value="FIFO">FIFO</option>
              </select>
            </label>
            <button type="button" disabled={busy} onClick={runSuggest}>
              Подобрать сырьё
            </button>
            <button type="button" disabled={!suggestions.length || busy} onClick={confirmMaterials}>
              Подтвердить резерв
            </button>
          </div>
          <p className="hint">
            GMP: на один компонент в серии — одна партия сырья. Можно вручную заменить партию из списка доступных.
          </p>
          {suggestions.map((s, oi) => {
            const order = orders.find((o) => o.id === s.orderId);
            return (
              <div key={s.orderId} className="suggest-card">
                <h3>
                  {order ? nameOf(order.materialId, dictionaries.materials) : s.orderId} · серия{' '}
                  {order ? nameOf(order.seriesId, dictionaries.series) : ''}
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
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Материал</th>
                        <th>Кол-во</th>
                        <th>Партия</th>
                        <th>Свободно</th>
                        <th>OK</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.picks.map((p, pi) => (
                        <PickRow
                          key={p.materialId}
                          pick={p}
                          algorithm={algorithm}
                          onChangeLot={(lotId) => changeLot(oi, pi, lotId)}
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
    </div>
  );
}

function PickRow({
  pick,
  algorithm,
  onChangeLot,
}: {
  pick: MaterialPick;
  algorithm: string;
  onChangeLot: (lotId: string) => void;
}) {
  const [lots, setLots] = useState<{ id: string; number: string; freeQty: number }[]>([]);
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    api.lotsAvailable(pick.materialId, algorithm).then((data) => setLots(data as typeof lots));
  }, [pick.materialId, algorithm]);

  return (
    <tr>
      <td>{pick.materialName}</td>
      <td>{pick.quantity}</td>
      <td>
        <select value={pick.lotId || ''} onChange={(e) => onChangeLot(e.target.value)}>
          <option value="">—</option>
          {lots.map((l) => (
            <option key={l.id} value={l.id}>
              {l.number} (своб. {l.freeQty})
            </option>
          ))}
        </select>
      </td>
      <td>{pick.freeQty ?? '—'}</td>
      <td>{pick.ok ? '✓' : '✗'}</td>
    </tr>
  );
}
