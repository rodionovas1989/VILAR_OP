import { useEffect, useRef, useState } from 'react';
import Gantt from 'frappe-gantt';
import './../frappe-gantt.css';
import { GanttTask } from '../api';

type Props = { tasks: GanttTask[] };

export default function GanttChart({ tasks }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; task: GanttTask } | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = '';
    if (!tasks.length) return;

    const byId = new Map(tasks.map((t) => [t.id, t]));

    const mapped = tasks.map((t) => ({
      id: t.id,
      name: `${t.workCenterName}: ${t.series}`,
      start: t.startAt.slice(0, 10),
      end: (() => {
        // frappe-gantt end is exclusive-ish; ensure at least 1 day visible
        const end = new Date(t.endAt);
        if (end.toISOString().slice(0, 10) === t.startAt.slice(0, 10)) {
          end.setDate(end.getDate() + 1);
        }
        return end.toISOString().slice(0, 10);
      })(),
      progress: t.progress,
      custom_class: `gantt-${t.status}`,
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    new (Gantt as any)(ref.current, mapped, {
      view_mode: 'Day',
      language: 'ru',
      popup_on: 'hover',
      readonly: true,
      scroll_to: 'start',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      popup: (ctx: any) => {
        const full = byId.get(ctx.task.id);
        if (!full) return false;
        const lines = (full.reservations || [])
          .map((r) => `<div>${r.material || '—'} · ${r.lot || '—'} · ${r.counterparty || '—'}</div>`)
          .join('');
        ctx.set_title(full.product || '');
        ctx.set_subtitle(`Серия: ${full.series || '—'}`);
        ctx.set_details(
          `<div>Статус: ${full.status}</div><div style="margin-top:6px"><em>Резерв:</em></div>${lines || '<div>—</div>'}`
        );
      },
    });

    const onMove = (ev: MouseEvent) => {
      const wrap = (ev.target as HTMLElement)?.closest?.('.bar-wrapper') as HTMLElement | null;
      if (!wrap) {
        setTooltip(null);
        return;
      }
      const id = wrap.getAttribute('data-id') || '';
      const full = byId.get(id);
      if (!full) return;
      setTooltip({ x: ev.clientX + 12, y: ev.clientY + 12, task: full });
    };
    ref.current.addEventListener('mousemove', onMove);
    return () => {
      ref.current?.removeEventListener('mousemove', onMove);
    };
  }, [tasks]);

  if (!tasks.length) return <p className="hint">Нет заказов для отображения.</p>;

  return (
    <div className="gantt-wrap">
      <div ref={ref} />
      {tooltip && (
        <div className="floating-tip" style={{ left: tooltip.x, top: tooltip.y }}>
          <strong>{tooltip.task.product}</strong>
          <div>Серия: {tooltip.task.series}</div>
          <div className="tip-res">
            {(tooltip.task.reservations || []).map((r, i) => (
              <div key={i}>
                {r.material}, {r.lot}, {r.counterparty}
              </div>
            ))}
            {!tooltip.task.reservations?.length && <div>Резерв не сформирован</div>}
          </div>
        </div>
      )}
    </div>
  );
}
