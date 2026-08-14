import { useEffect, useState } from 'react';
import {
  cloneFilters,
  ColumnFilters,
  getColumnFilter,
  ListColumn,
  MAX_SORT_LEVELS,
  SortRule,
} from '../hooks/useListTable';
import ColumnFilterDropdown from './ColumnFilterDropdown';

type SettingsProps<T> = {
  open: boolean;
  onClose: () => void;
  columns: ListColumn<T>[];
  filterOptions: Record<string, string[]>;
  filters: ColumnFilters;
  sortRules: SortRule[];
  onApply: (filters: ColumnFilters, sortRules: SortRule[]) => void;
  onReset: () => void;
  activeFilterCount: number;
};

type ButtonProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeFilterCount: number;
  sortRulesCount: number;
};

function filterChipLabels(filters: ColumnFilters, key: string): string[] {
  const selected = getColumnFilter(filters, key);
  if (selected === null) return [];
  return [...selected];
}

export function ListViewSettingsButton({
  open,
  onOpenChange,
  activeFilterCount,
  sortRulesCount,
}: ButtonProps) {
  const activeCount = activeFilterCount + sortRulesCount;
  return (
    <button
      type="button"
      className={`ghost list-settings-btn${activeCount ? ' list-settings-btn-active' : ''}`}
      onClick={() => onOpenChange(!open)}
    >
      Отбор и сортировка{activeCount ? ` (${activeCount})` : ''}
      <span className="list-settings-chevron" aria-hidden>
        {open ? ' ▴' : ' ▾'}
      </span>
    </button>
  );
}

export function ListViewSettingsPanel<T>({
  open,
  onClose,
  columns,
  filterOptions,
  filters,
  sortRules,
  onApply,
  onReset,
  activeFilterCount,
}: SettingsProps<T>) {
  const filterableColumns = columns.filter((c) => c.filterable !== false);
  const sortableColumns = columns.filter((c) => c.sortable !== false);

  const [draftFilters, setDraftFilters] = useState<ColumnFilters>({});
  const [draftSortRules, setDraftSortRules] = useState<SortRule[]>([]);
  const [openFilterKey, setOpenFilterKey] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDraftFilters(cloneFilters(filters));
    setDraftSortRules([...sortRules]);
    setOpenFilterKey(null);
  }, [open, filters, sortRules]);

  const setDraftFilter = (key: string, next: Set<string> | null) => {
    setDraftFilters((prev) => {
      const copy = { ...prev };
      if (next === null) delete copy[key];
      else copy[key] = next;
      return copy;
    });
  };

  const updateSortRule = (index: number, patch: Partial<SortRule>) => {
    setDraftSortRules((prev) => prev.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)));
  };

  const addSortRule = () => {
    if (draftSortRules.length >= MAX_SORT_LEVELS || !sortableColumns.length) return;
    const used = new Set(draftSortRules.map((r) => r.key));
    const nextCol = sortableColumns.find((c) => !used.has(c.key)) || sortableColumns[0];
    setDraftSortRules((prev) => [...prev, { key: nextCol.key, dir: 'asc' }]);
  };

  const removeSortRule = (index: number) => {
    setDraftSortRules((prev) => prev.filter((_, i) => i !== index));
  };

  const handleReset = () => {
    onReset();
    setDraftFilters({});
    setDraftSortRules([]);
    setOpenFilterKey(null);
  };

  const handleApply = () => {
    onApply(draftFilters, draftSortRules);
    onClose();
  };

  const draftActiveCount = Object.keys(draftFilters).length + draftSortRules.length;
  const appliedActiveCount = activeFilterCount + sortRules.length;

  return (
    <div className="list-view-settings">
      <div className="list-view-settings-head">
        <span className="list-view-settings-title">Настройки списка</span>
        <div className="list-view-settings-actions">
          <button type="button" className="ghost" onClick={handleReset} disabled={!draftActiveCount && !appliedActiveCount}>
            Сбросить
          </button>
          <button type="button" onClick={handleApply}>
            Применить
          </button>
        </div>
      </div>

      <div className="list-view-settings-grid">
        <section className="list-view-settings-block">
          <h3 className="list-view-settings-block-title">Фильтры</h3>
          {!filterableColumns.length && <p className="hint">Нет фильтруемых колонок</p>}
          <div className="list-view-filters-column">
            {filterableColumns.map((col) => {
              const selected = getColumnFilter(draftFilters, col.key);
              const chips = filterChipLabels(draftFilters, col.key);
              return (
                <div key={col.key} className="list-view-filter-row">
                  <div className="list-view-filter-dropdown-wrap">
                    <span className="list-view-filter-label">{col.label}</span>
                    <ColumnFilterDropdown
                      title={col.label}
                      options={filterOptions[col.key] || []}
                      selected={selected}
                      onChange={(next) => setDraftFilter(col.key, next)}
                      open={openFilterKey === col.key}
                      onOpenChange={(isOpen) => setOpenFilterKey(isOpen ? col.key : null)}
                    />
                  </div>
                  <div className="list-view-filter-chips">
                    {selected === null && <span className="filter-chip filter-chip-all">Все значения</span>}
                    {selected !== null && chips.length === 0 && (
                      <span className="filter-chip filter-chip-empty">Ничего не выбрано</span>
                    )}
                    {chips.map((value) => (
                      <span key={value} className="filter-chip" title={value}>
                        {value || '—'}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="list-view-settings-block">
          <h3 className="list-view-settings-block-title">Сортировка</h3>
          <p className="hint list-view-settings-hint">
            До {MAX_SORT_LEVELS} уровней: сначала по первому полю, затем по второму.
          </p>
          <div className="list-view-sort-rules">
            {draftSortRules.map((rule, index) => (
              <div key={index} className="list-view-sort-rule">
                <span className="list-view-sort-index">{index + 1}.</span>
                <select value={rule.key} onChange={(e) => updateSortRule(index, { key: e.target.value })}>
                  {sortableColumns.map((col) => (
                    <option key={col.key} value={col.key}>
                      {col.label}
                    </option>
                  ))}
                </select>
                <select
                  value={rule.dir}
                  onChange={(e) => updateSortRule(index, { dir: e.target.value as 'asc' | 'desc' })}
                >
                  <option value="asc">По возрастанию</option>
                  <option value="desc">По убыванию</option>
                </select>
                <button type="button" className="ghost list-view-sort-remove" onClick={() => removeSortRule(index)}>
                  ×
                </button>
              </div>
            ))}
          </div>
          {draftSortRules.length < MAX_SORT_LEVELS && sortableColumns.length > 0 && (
            <button type="button" className="ghost" onClick={addSortRule}>
              {draftSortRules.length ? '+ Уровень сортировки' : '+ Добавить сортировку'}
            </button>
          )}
        </section>
      </div>
    </div>
  );
}
