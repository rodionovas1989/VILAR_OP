import { useEffect, useRef, useState } from 'react';

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

export default function ActionsMenu({ label = 'Действия', items, onSelect, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  if (!items.length) return null;

  return (
    <div className={`actions-menu ${open ? 'is-open' : ''}`} ref={rootRef}>
      <button
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
      {open && (
        <div className="actions-menu-panel" role="menu">
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
        </div>
      )}
    </div>
  );
}
