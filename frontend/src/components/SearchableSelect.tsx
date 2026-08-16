import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type SearchableOption = {
  value: string;
  label: string;
  disabled?: boolean;
  className?: string;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: SearchableOption[];
  /** Подпись пустого значения в триггере и списке */
  emptyLabel?: string;
  /** Показывать пункт очистки (value ""). По умолчанию true */
  allowEmpty?: boolean;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  triggerClassName?: string;
  name?: string;
  'aria-label'?: string;
};

type PanelPos = { top: number; left: number; width: number; maxHeight: number; placement: 'below' | 'above' };

function norm(s: string) {
  return s.trim().toLowerCase();
}

function computePos(trigger: HTMLElement): PanelPos {
  const rect = trigger.getBoundingClientRect();
  const gap = 4;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.max(rect.width, 180);
  const spaceBelow = vh - rect.bottom - gap - 8;
  const spaceAbove = rect.top - gap - 8;
  const preferBelow = spaceBelow >= 160 || spaceBelow >= spaceAbove;
  const maxHeight = Math.min(280, Math.max(120, preferBelow ? spaceBelow : spaceAbove));
  let left = rect.left;
  if (left + width > vw - 8) left = Math.max(8, vw - 8 - width);
  if (left < 8) left = 8;
  if (preferBelow) {
    return { top: rect.bottom + gap, left, width, maxHeight, placement: 'below' };
  }
  return {
    top: Math.max(8, rect.top - gap - maxHeight),
    left,
    width,
    maxHeight,
    placement: 'above',
  };
}

/** Выпадающий список с полем поиска вверху панели (замена native select). */
export default function SearchableSelect({
  value,
  onChange,
  options,
  emptyLabel = '—',
  allowEmpty = true,
  placeholder,
  disabled = false,
  required = false,
  className = '',
  triggerClassName = '',
  name,
  'aria-label': ariaLabel,
}: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [pos, setPos] = useState<PanelPos | null>(null);

  const selected = options.find((o) => o.value === value);
  const triggerText = selected?.label ?? (value ? value : placeholder || emptyLabel);

  const filtered = useMemo(() => {
    const q = norm(query);
    if (!q) return options;
    return options.filter((o) => norm(o.label).includes(q) || norm(o.value).includes(q));
  }, [options, query]);

  const showEmpty =
    allowEmpty && (!query.trim() || norm(emptyLabel).includes(norm(query)) || norm(query) === '—');

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
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    const t = window.setTimeout(() => searchRef.current?.focus(), 0);
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onReposition = () => updatePos();
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onReposition);
    // capture scroll from nested overflow containers
    window.addEventListener('scroll', onReposition, true);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open]);

  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  const panel =
    open &&
    pos &&
    createPortal(
      <div
        ref={panelRef}
        className={`searchable-select-panel searchable-select-panel-portal placement-${pos.placement}`}
        role="presentation"
        style={{
          top: pos.top,
          left: pos.left,
          width: pos.width,
          maxHeight: pos.maxHeight,
        }}
      >
        <div className="searchable-select-search">
          <input
            ref={searchRef}
            type="search"
            value={query}
            placeholder="Поиск…"
            aria-label="Поиск в списке"
            autoComplete="off"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                const first = filtered.find((o) => !o.disabled);
                if (first) pick(first.value);
                else if (showEmpty) pick('');
              }
            }}
          />
        </div>
        <ul id={listId} className="searchable-select-list" role="listbox">
          {showEmpty && (
            <li role="option" aria-selected={value === ''}>
              <button
                type="button"
                className={`searchable-select-option${value === '' ? ' selected' : ''}`}
                onClick={() => pick('')}
              >
                {emptyLabel}
              </button>
            </li>
          )}
          {filtered.map((o) => (
            <li key={o.value} role="option" aria-selected={o.value === value} aria-disabled={o.disabled}>
              <button
                type="button"
                className={`searchable-select-option${o.value === value ? ' selected' : ''}${
                  o.className ? ` ${o.className}` : ''
                }`}
                disabled={o.disabled}
                onClick={() => !o.disabled && pick(o.value)}
              >
                {o.label}
              </button>
            </li>
          ))}
          {!showEmpty && filtered.length === 0 && (
            <li className="searchable-select-empty">Ничего не найдено</li>
          )}
        </ul>
      </div>,
      document.body,
    );

  return (
    <div
      ref={rootRef}
      className={`searchable-select${open ? ' open' : ''}${disabled ? ' disabled' : ''} ${className}`.trim()}
    >
      {required && (
        <input
          className="searchable-select-required"
          tabIndex={-1}
          value={value}
          required
          onChange={() => {}}
          aria-hidden
        />
      )}
      {name != null && <input type="hidden" name={name} value={value} />}
      <button
        ref={triggerRef}
        type="button"
        className={`searchable-select-trigger ${triggerClassName}`.trim()}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        onClick={() => !disabled && setOpen((v) => !v)}
      >
        <span className={`searchable-select-value${!selected && !value ? ' is-placeholder' : ''}`}>
          {triggerText}
        </span>
        <span className="searchable-select-caret" aria-hidden>
          {open ? '▴' : '▾'}
        </span>
      </button>
      {panel}
    </div>
  );
}
