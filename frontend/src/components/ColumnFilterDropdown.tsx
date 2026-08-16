import ColumnFilterList from './ColumnFilterList';

type Props = {
  title: string;
  options: string[];
  /** null — без отбора (все) */
  selected: Set<string> | null;
  onChange: (next: Set<string> | null) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** inline — список под кнопкой (для панелей со скроллом); overlay — абсолютный слой */
  variant?: 'overlay' | 'inline';
};

/** Дропдаун-фильтр с чекбоксами */
export default function ColumnFilterDropdown({
  title,
  options,
  selected,
  onChange,
  open,
  onOpenChange,
  variant = 'overlay',
}: Props) {
  const active =
    selected !== null && selected.size > 0 && (options.length === 0 || selected.size < options.length);

  const label =
    selected === null
      ? 'Все'
      : selected.size === 0
        ? 'Ничего'
        : selected.size === 1
          ? [...selected][0]
          : `Выбрано: ${selected.size}`;

  return (
    <div
      className={`col-filter col-filter-${variant}${open ? ' open' : ''}${active ? ' active' : ''}`}
    >
      <button
        type="button"
        className="col-filter-trigger"
        title={`Отбор: ${title}`}
        onClick={() => onOpenChange(!open)}
      >
        <span className="col-filter-text">{label}</span>
        <span className="col-filter-caret" aria-hidden>
          {open ? '▴' : '▾'}
        </span>
      </button>
      {open && (
        <div
          className={variant === 'inline' ? 'col-filter-panel-inline' : 'col-filter-panel'}
          role="listbox"
          aria-multiselectable
        >
          <ColumnFilterList options={options} selected={selected} onChange={onChange} />
        </div>
      )}
    </div>
  );
}
