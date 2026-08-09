import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as echarts from 'echarts';
import { GanttTask } from '../api';

type Props = { tasks: GanttTask[] };

type BarDatum = {
  value: [number, number, number, number, string];
  task: GanttTask;
  laneCount: number;
};

type TipState = { task: GanttTask; x: number; y: number };

const STATUS_STYLE: Record<string, { fill: string; stroke: string; lineWidth: number; textFill: string }> = {
  новый: { fill: 'rgba(255,255,255,0.92)', stroke: '#5b6b7c', lineWidth: 2, textFill: '#132033' },
  спланирован: { fill: '#1a7a62', stroke: '#0f4d3e', lineWidth: 1, textFill: '#fff' },
  завершен: { fill: '#2f5d9f', stroke: '#1e3a5f', lineWidth: 1, textFill: '#fff' },
  отменен: { fill: '#b42318', stroke: '#7a1710', lineWidth: 1, textFill: '#fff' },
};

function assignLanes(items: { start: number; end: number; id: string }[]) {
  const sorted = [...items].sort((a, b) => a.start - b.start || a.end - b.end);
  const laneEnds: number[] = [];
  const laneById = new Map<string, number>();

  for (const it of sorted) {
    let lane = laneEnds.findIndex((end) => end <= it.start);
    if (lane < 0) {
      lane = laneEnds.length;
      laneEnds.push(it.end);
    } else {
      laneEnds[lane] = it.end;
    }
    laneById.set(it.id, lane);
  }
  return { laneById, laneCount: Math.max(laneEnds.length, 1) };
}

function buildModel(tasks: GanttTask[]) {
  const wcMap = new Map<string, string>();
  for (const t of tasks) {
    if (t.workCenterId) wcMap.set(t.workCenterId, t.workCenterName || t.workCenterId);
  }
  const workCenters = [...wcMap.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  const indexByWc = new Map(workCenters.map((w, i) => [w.id, i]));

  let minTime = Number.POSITIVE_INFINITY;
  let maxTime = Number.NEGATIVE_INFINITY;
  const byWc = new Map<string, { start: number; end: number; id: string; task: GanttTask }[]>();

  for (const t of tasks) {
    if (!indexByWc.has(t.workCenterId)) continue;
    const start = new Date(t.startAt).getTime();
    let end = new Date(t.endAt).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    if (end <= start) end = start + 60 * 60 * 1000;
    minTime = Math.min(minTime, start);
    maxTime = Math.max(maxTime, end);
    const list = byWc.get(t.workCenterId) || [];
    list.push({ start, end, id: t.id, task: t });
    byWc.set(t.workCenterId, list);
  }

  const seriesData: BarDatum[] = [];
  for (const [wcId, list] of byWc) {
    const { laneById, laneCount } = assignLanes(list);
    const wcIndex = indexByWc.get(wcId)!;
    for (const it of list) {
      seriesData.push({
        value: [wcIndex, it.start, it.end, laneById.get(it.id) || 0, it.id],
        task: it.task,
        laneCount,
      });
    }
  }

  if (!Number.isFinite(minTime)) {
    const now = Date.now();
    minTime = now;
    maxTime = now + 86400000;
  } else {
    const pad = Math.max((maxTime - minTime) * 0.03, 2 * 60 * 60 * 1000);
    minTime -= pad;
    maxTime += pad;
  }

  return { workCenters, seriesData, minTime, maxTime };
}

function clampTip(x: number, y: number, tipW: number, tipH: number) {
  const pad = 8;
  let left = x + 14;
  let top = y + 14;
  if (left + tipW > window.innerWidth - pad) left = Math.max(pad, x - tipW - 14);
  if (top + tipH > window.innerHeight - pad) top = Math.max(pad, y - tipH - 14);
  if (left < pad) left = pad;
  if (top < pad) top = pad;
  return { left, top };
}

export default function GanttChart({ tasks }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [tip, setTip] = useState<TipState | null>(null);
  const [tipPos, setTipPos] = useState<{ left: number; top: number } | null>(null);
  const model = useMemo(() => buildModel(tasks), [tasks]);
  const modelRef = useRef(model);
  modelRef.current = model;

  useLayoutEffect(() => {
    if (!tip || !tipRef.current) {
      setTipPos(null);
      return;
    }
    const rect = tipRef.current.getBoundingClientRect();
    setTipPos(clampTip(tip.x, tip.y, rect.width, rect.height));
  }, [tip]);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;

    let disposed = false;
    let chart = echarts.getInstanceByDom(el);
    if (!chart) chart = echarts.init(el, undefined, { renderer: 'canvas' });

    const onResize = () => {
      if (!disposed) chart?.resize();
    };
    window.addEventListener('resize', onResize);

    const onMove = (params: unknown) => {
      const p = params as {
        seriesType?: string;
        data?: BarDatum;
        event?: { event?: MouseEvent; offsetX?: number; offsetY?: number };
      };
      if (p.seriesType !== 'custom' || !p.data?.task) return;
      const ev = p.event?.event;
      const x = ev?.clientX ?? 0;
      const y = ev?.clientY ?? 0;
      setTip({ task: p.data.task, x, y });
    };
    const onOut = () => setTip(null);

    chart.on('mousemove', onMove);
    chart.on('globalout', onOut);

    try {
      setError(null);

      if (!model.seriesData.length) {
        chart.clear();
      } else {
        const categories = model.workCenters.map((w) => w.name);
        const maxLanes = Math.max(1, ...model.seriesData.map((d) => d.laneCount));
        el.style.height = `${Math.max(300, model.workCenters.length * Math.max(64, maxLanes * 28 + 28) + 120)}px`;
        chart.resize();

        const option: echarts.EChartsOption = {
          animation: false,
          tooltip: { show: false },
          grid: { left: 140, right: 24, top: 28, bottom: 64 },
          dataZoom: [
            { type: 'slider', xAxisIndex: 0, height: 18, bottom: 12, filterMode: 'weakFilter' },
            { type: 'inside', xAxisIndex: 0, filterMode: 'weakFilter' },
          ],
          xAxis: {
            type: 'time',
            min: model.minTime,
            max: model.maxTime,
            axisLabel: {
              hideOverlap: true,
              formatter: (val: number) => {
                const d = new Date(val);
                const dd = String(d.getDate()).padStart(2, '0');
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const hh = String(d.getHours()).padStart(2, '0');
                const mi = String(d.getMinutes()).padStart(2, '0');
                return `${dd}.${mm}\n${hh}:${mi}`;
              },
            },
            splitLine: { show: true, lineStyle: { color: '#e2e8ee' } },
          },
          yAxis: {
            type: 'category',
            data: categories,
            axisLabel: { width: 120, overflow: 'truncate' },
            splitArea: {
              show: true,
              areaStyle: { color: ['rgba(15,42,61,0.03)', 'rgba(15,42,61,0.00)'] },
            },
          },
          series: [
            {
              type: 'custom',
              clip: true,
              renderItem: (params, api) => {
                const categoryIndex = Number(api.value(0));
                const startMs = Number(api.value(1));
                const endMs = Number(api.value(2));
                const lane = Number(api.value(3));
                const start = api.coord([startMs, categoryIndex]);
                const end = api.coord([endMs, categoryIndex]);
                if (!start || !end) return;

                const sizeRaw = api.size ? (api.size([0, 1]) as number[]) : null;
                const band = sizeRaw && sizeRaw[1] ? sizeRaw[1] : 40;
                const datum = modelRef.current.seriesData[params.dataIndexInside];
                const lanes = datum?.laneCount || 1;
                const gap = 4;
                const usable = Math.max(band - gap * 2, 12);
                const barHeight = Math.max(12, Math.min(22, (usable - gap * (lanes - 1)) / lanes));
                const block = lanes * barHeight + (lanes - 1) * gap;
                const x = start[0];
                const y = start[1] - block / 2 + lane * (barHeight + gap);
                const width = Math.max(end[0] - start[0], 4);
                const status = datum?.task.status || 'спланирован';
                const style = STATUS_STYLE[status] || STATUS_STYLE['спланирован'];
                const label = datum?.task.series || '';

                return {
                  type: 'group',
                  children: [
                    {
                      type: 'rect',
                      shape: { x, y, width, height: barHeight, r: 4 },
                      style: {
                        fill: style.fill,
                        stroke: style.stroke,
                        lineWidth: style.lineWidth,
                        opacity: 0.95,
                      },
                    },
                    {
                      type: 'text',
                      style: {
                        x: x + 6,
                        y: y + barHeight / 2,
                        text: width > 40 ? label : '',
                        fill: style.textFill,
                        font: '12px Segoe UI, sans-serif',
                        verticalAlign: 'middle',
                        align: 'left',
                        width: Math.max(width - 10, 0),
                        overflow: 'truncate',
                      },
                    },
                  ],
                };
              },
              encode: { x: [1, 2], y: 0 },
              data: model.seriesData.map((d) => ({
                value: d.value,
                task: d.task,
                laneCount: d.laneCount,
                itemStyle: { color: (STATUS_STYLE[d.task.status] || STATUS_STYLE['спланирован']).fill },
              })),
            },
          ],
        };

        chart.setOption(option, true);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      console.error('GanttChart error', e);
    }

    return () => {
      disposed = true;
      window.removeEventListener('resize', onResize);
      chart.off('mousemove', onMove);
      chart.off('globalout', onOut);
      chart?.dispose();
    };
  }, [model]);

  const tipTask = tip?.task;

  return (
    <div className="gantt-wrap">
      <p className="hint" style={{ marginTop: 0 }}>
        Дорожки = рабочие центры. Параллельные заказы на одном РЦ — отдельные полосы. Масштаб: колесо / ползунок.
      </p>
      <div className="gantt-legend">
        <span>
          <i className="lg-new" /> новый
        </span>
        <span>
          <i className="lg-planned" /> спланирован
        </span>
        <span>
          <i className="lg-done" /> завершен
        </span>
        <span>
          <i className="lg-cancel" /> отменен
        </span>
      </div>
      {error && <div className="alert">Ошибка диаграммы: {error}</div>}
      {!tasks.length && !error && <p className="hint">Нет заказов для отображения.</p>}
      <div
        ref={hostRef}
        className="echarts-gantt"
        style={{ width: '100%', minHeight: 280, display: tasks.length ? 'block' : 'none' }}
      />
      {tipTask && (
        <div
          ref={tipRef}
          className="gantt-float-tip"
          style={{
            left: tipPos?.left ?? tip.x + 14,
            top: tipPos?.top ?? tip.y + 14,
            visibility: tipPos ? 'visible' : 'hidden',
          }}
        >
          <strong>{tipTask.product || '—'}</strong>
          <div>Серия: {tipTask.series || '—'}</div>
          <div>РЦ: {tipTask.workCenterName || '—'}</div>
          <div>Статус: {tipTask.status}</div>
          <div>
            {new Date(tipTask.startAt).toLocaleString('ru-RU')} — {new Date(tipTask.endAt).toLocaleString('ru-RU')}
          </div>
          <div className="tip-res">
            {(tipTask.reservations || []).length ? (
              <>
                <em>Резерв:</em>
                {(tipTask.reservations || []).map((r, i) => (
                  <div key={i}>
                    {r.material || '—'} · {r.lot || '—'} · {r.counterparty || '—'}
                  </div>
                ))}
              </>
            ) : (
              <div>Резерв не сформирован</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
