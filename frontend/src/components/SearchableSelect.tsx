import { useEffect, useId, useMemo, useRef, useState } from 'react';

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

function norm(s: string) {
  return s.trim().toLowerCase();
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
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = options.find((o) => o.value === value);
  const triggerText = selected?.label ?? (value ? value : placeholder || emptyLabel);

  const filtered = useMemo(() => {
    const q = norm(query);
    if (!q) return options;
    return options.filter((o) => norm(o.label).includes(q) || norm(o.value).includes(q));
  }, [options, query]);

  const showEmpty =
    allowEmpty && (!query.trim() || norm(emptyLabel).includes(norm(query)) || norm(query) === '—');

  useEffect(() => {
    if (!open) return;
    setQuery('');
    const t = window.setTimeout(() => searchRef.current?.focus(), 0);
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
  };

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
      {open && (
        <div className="searchable-select-panel" role="presentation">
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
        </div>
      )}
    </div>
  );
}
