type Props = {
  options: string[];
  /** null — без отбора (все); пустой Set — ничего не выбрано */
  selected: Set<string> | null;
  onChange: (next: Set<string> | null) => void;
};

/** Список чекбоксов для отбора значений колонки */
export default function ColumnFilterList({ options, selected, onChange }: Props) {
  const allMode = selected === null;
  const selectedCount = allMode ? options.length : selected.size;
  const allChecked = options.length > 0 && selectedCount === options.length;
  const noneChecked = !allMode && selected.size === 0;

  return (
    <div className="col-filter-list col-filter-list-inline">
      <label className="col-filter-item col-filter-all">
        <input
          type="checkbox"
          checked={allChecked}
          ref={(el) => {
            if (el) el.indeterminate = !allChecked && !noneChecked && !allMode;
          }}
          onChange={() => {
            if (allChecked) onChange(new Set());
            else onChange(null);
          }}
        />
        <span>Выбрать все</span>
      </label>
      {options.map((v) => {
        const checked = allMode || Boolean(selected?.has(v));
        return (
          <label key={v} className="col-filter-item">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => {
                if (allMode) {
                  if (e.target.checked) onChange(null);
                  else onChange(new Set(options.filter((x) => x !== v)));
                  return;
                }
                const base = selected ? new Set(selected) : new Set<string>();
                if (e.target.checked) base.add(v);
                else base.delete(v);
                if (base.size === 0) onChange(new Set());
                else if (base.size === options.length) onChange(null);
                else onChange(base);
              }}
            />
            <span title={v}>{v || '—'}</span>
          </label>
        );
      })}
      {!options.length && <div className="muted col-filter-empty">Нет значений</div>}
    </div>
  );
}
