import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type SearchableOption = {
  value: string;
  label: string;
  disabled?: boolean;
  className?: string;
};

export type SearchMatchMode = 'label' | 'label-prefix';

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: SearchableOption[];
  /** Подпись пустого значения в триггере и списке */
  emptyLabel?: string;
  /** Показывать пункт очистки (value ""). По умолчанию true */
  allowEmpty?: boolean;
  /**
   * Поиск только по label (не по value/UUID).
   * `label` — короткий запрос (1–2) только prefix; с 3 символов ещё mid-includes.
   * `label-prefix` — всегда только начало подписи.
   */
  matchMode?: SearchMatchMode;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  triggerClassName?: string;
  name?: string;
  'aria-label'?: string;
};

type PanelPos = { top: number; left: number; width: number; maxHeight: number; placement: 'below' | 'above' };

let measureCtx: CanvasRenderingContext2D | null | undefined;

function measureContentWidth(labels: string[], font: string): number {
  if (measureCtx === undefined) {
    const canvas = document.createElement('canvas');
    measureCtx = canvas.getContext('2d');
  }
  if (!measureCtx) return 0;
  measureCtx.font = font;
  let max = 0;
  for (const label of labels) {
    const w = measureCtx.measureText(label).width;
    if (w > max) max = w;
  }
  return Math.ceil(max);
}

function norm(s: string) {
  return s.trim().toLowerCase();
}

/** Совпадение по подписи; value (UUID) не участвует — иначе «рандом» на 1–2 цифрах. */
export function optionMatchesQuery(
  option: SearchableOption,
  rawQuery: string,
  mode: SearchMatchMode = 'label'
): boolean {
  const q = norm(rawQuery);
  if (!q) return true;
  const label = norm(option.label);
  if (mode === 'label-prefix') return label.startsWith(q);
  if (label.startsWith(q)) return true;
  // Короткие запросы — только prefix (цифры часто встречаются в середине номера)
  if (q.length < 3) return false;
  return label.includes(q);
}

/** Ширина панели ≥ триггера и под длинные подписи (как у системного select), без горизонтального скролла. */
function computePos(trigger: HTMLElement, contentWidth: number): PanelPos {
  const rect = trigger.getBoundingClientRect();
  const gap = 4;
  const edge = 8;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const maxPanel = Math.min(vw - edge * 2, 560);
  const width = Math.min(maxPanel, Math.max(rect.width, contentWidth, 180));
  const spaceBelow = vh - rect.bottom - gap - edge;
  const spaceAbove = rect.top - gap - edge;
  const preferBelow = spaceBelow >= 180 || spaceBelow >= spaceAbove;
  const maxHeight = Math.min(360, Math.max(140, preferBelow ? spaceBelow : spaceAbove));
  let left = rect.left;
  if (left + width > vw - edge) left = Math.max(edge, vw - edge - width);
  if (left < edge) left = edge;
  if (preferBelow) {
    return { top: rect.bottom + gap, left, width, maxHeight, placement: 'below' };
  }
  return {
    top: Math.max(edge, rect.top - gap - maxHeight),
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
  matchMode = 'label',
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
  const looksLikeRawId =
    !!value &&
    (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(value) ||
      value.includes('::'));
  const triggerText =
    selected?.label ??
    (value ? (looksLikeRawId ? 'партия' : value) : placeholder || emptyLabel);

  const filtered = useMemo(() => {
    const q = norm(query);
    if (!q) return options;
    return options.filter((o) => optionMatchesQuery(o, query, matchMode));
  }, [options, query, matchMode]);

  const showEmpty =
    allowEmpty && (!query.trim() || norm(emptyLabel).includes(norm(query)) || norm(query) === '—');

  const updatePos = () => {
    const el = triggerRef.current;
    if (!el) return;
    const style = window.getComputedStyle(el);
    const font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const labels = [
      ...(showEmpty ? [emptyLabel] : []),
      ...filtered.map((o) => o.label),
      'Ничего не найдено',
    ];
    // padding опций + запас под скроллбар, если появится по высоте
    const contentWidth = measureContentWidth(labels, font) + 36;
    setPos(computePos(el, contentWidth));
  };

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    updatePos();
  }, [open, filtered, showEmpty, emptyLabel]);

  // Уточнить ширину по реальному DOM (шрифты/иконки), без горизонтального overflow
  useLayoutEffect(() => {
    if (!open || !pos || !panelRef.current || !triggerRef.current) return;
    const panel = panelRef.current;
    const needed = Math.ceil(panel.scrollWidth);
    const maxPanel = Math.min(window.innerWidth - 16, 560);
    const target = Math.min(needed, maxPanel);
    if (target > pos.width + 1) {
      setPos(computePos(triggerRef.current, target));
    }
  }, [open, pos?.width, filtered, query]);

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
