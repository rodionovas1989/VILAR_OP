import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type ActionMenuItem = {
  id: string;
  label: string;
  danger?: boolean;
  disabled?: boolean;
};

type Props = {
  label?: string;
  items: ActionMenuItem[];
  onSelect: (id: string) => void;
  disabled?: boolean;
};

type PanelPos = { top: number; left: number; minWidth: number };

function computePos(trigger: HTMLElement): PanelPos {
  const rect = trigger.getBoundingClientRect();
  const minWidth = Math.max(180, Math.ceil(rect.width));
  const gap = 4;
  const estimatedHeight = 200;
  const spaceBelow = window.innerHeight - rect.bottom - 8;
  const placeAbove = spaceBelow < estimatedHeight && rect.top > spaceBelow;
  let top = placeAbove ? rect.top - gap : rect.bottom + gap;
  // align to right edge of trigger (меню в шапке справа)
  let left = rect.right - minWidth;
  left = Math.max(8, Math.min(left, window.innerWidth - minWidth - 8));
  if (placeAbove) {
    // top will be adjusted after measure; provisional
    top = rect.top - gap;
  }
  return { top, left, minWidth };
}

export default function ActionsMenu({ label = 'Действия', items, onSelect, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<PanelPos | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const updatePos = () => {
    const el = triggerRef.current;
    if (!el) return;
    setPos(computePos(el));
  };

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    updatePos();
  }, [open, items.length]);

  useLayoutEffect(() => {
    if (!open || !pos || !panelRef.current || !triggerRef.current) return;
    const panel = panelRef.current;
    const trigger = triggerRef.current;
    const rect = trigger.getBoundingClientRect();
    const h = panel.offsetHeight;
    const gap = 4;
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const placeAbove = spaceBelow < h && rect.top > spaceBelow;
    const nextTop = placeAbove ? Math.max(8, rect.top - h - gap) : rect.bottom + gap;
    if (Math.abs(nextTop - pos.top) > 1) {
      setPos((p) => (p ? { ...p, top: nextTop } : p));
    }
  }, [open, pos?.top, pos?.left, items.length]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onReposition = () => updatePos();
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open]);

  if (!items.length) return null;

  const panel =
    open &&
    pos &&
    createPortal(
      <div
        ref={panelRef}
        className="actions-menu-panel actions-menu-panel-portal"
        role="menu"
        style={{ top: pos.top, left: pos.left, minWidth: pos.minWidth }}
      >
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            className={`actions-menu-item ${item.danger ? 'is-danger' : ''}`.trim()}
            disabled={item.disabled}
            onClick={() => {
              setOpen(false);
              onSelect(item.id);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>,
      document.body
    );

  return (
    <div className={`actions-menu ${open ? 'is-open' : ''}`} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="actions-menu-trigger ghost"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {label}
        <span className="actions-menu-chevron" aria-hidden>
          ▾
        </span>
      </button>
      {panel}
    </div>
  );
}
