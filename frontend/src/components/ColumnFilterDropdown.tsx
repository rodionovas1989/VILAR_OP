type Props = {
  title: string;
  /** Все уникальные значения колонки */
  options: string[];
  /** Выбранные значения; пустой Set = показать все */
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** Дропдаун-фильтр с чекбоксами (пустой выбор = без отбора) */
export default function ColumnFilterDropdown({
  title,
  options,
  selected,
  onChange,
  open,
  onOpenChange,
}: Props) {
  const active = selected.size > 0 && selected.size < options.length;
  const allChecked = options.length > 0 && selected.size === 0;

  const label =
    selected.size === 0
      ? 'Все'
      : selected.size === 1
        ? [...selected][0]
        : `Выбрано: ${selected.size}`;

  return (
    <div className={`col-filter${open ? ' open' : ''}${active ? ' active' : ''}`}>
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
        <div className="col-filter-panel" role="listbox" aria-multiselectable>
          <label className="col-filter-item col-filter-all">
            <input
              type="checkbox"
              checked={allChecked}
              onChange={(e) => {
                if (e.target.checked) onChange(new Set());
                else onChange(new Set(options));
              }}
            />
            <span>Все</span>
          </label>
          <div className="col-filter-list">
            {options.map((v) => {
              const checked = selected.size === 0 || selected.has(v);
              return (
                <label key={v} className="col-filter-item">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      if (selected.size === 0) {
                        // было «все» — оставляем только этот или все кроме этого
                        if (e.target.checked) onChange(new Set());
                        else onChange(new Set(options.filter((x) => x !== v)));
                        return;
                      }
                      const next = new Set(selected);
                      if (e.target.checked) next.add(v);
                      else next.delete(v);
                      if (next.size === 0 || next.size === options.length) onChange(new Set());
                      else onChange(next);
                    }}
                  />
                  <span title={v}>{v || '—'}</span>
                </label>
              );
            })}
            {!options.length && <div className="muted col-filter-empty">Нет значений</div>}
          </div>
        </div>
      )}
    </div>
  );
}
