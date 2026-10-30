import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  cloneFilters,
  ColumnFilters,
  getColumnFilter,
  ListColumn,
  MAX_SORT_LEVELS,
  SortRule,
} from '../hooks/useListTable';
import ColumnFilterList from './ColumnFilterList';
import IconButton from './IconButton';
import SearchableSelect from './SearchableSelect';

type Props<T> = {
  columns: ListColumn<T>[];
  filterOptions: Record<string, string[]>;
  filters: ColumnFilters;
  sortRules: SortRule[];
  onApply: (filters: ColumnFilters, sortRules: SortRule[]) => void;
  activeFilterCount: number;
};

type PanelId = 'filters' | 'sort';

type PopoverPos = { top: number; left: number; maxHeight: number };

function selectionLabel(selected: Set<string> | null): string {
  if (selected === null) return 'Все';
  if (selected.size === 0) return 'Ничего не выбрано';
  return `Выбрано: ${selected.size}`;
}

function measurePopover(anchor: HTMLElement, panelEl: HTMLElement): PopoverPos {
  const rect = anchor.getBoundingClientRect();
  const gap = 6;
  const width = panelEl.offsetWidth;
  const natural = panelEl.offsetHeight;
  const spaceBelow = window.innerHeight - rect.bottom - gap - 8;
  const spaceAbove = rect.top - gap - 8;
  const placeAbove = spaceBelow < Math.min(natural, 240) && spaceAbove > spaceBelow;
  const available = Math.max(160, placeAbove ? spaceAbove : spaceBelow);
  const used = Math.min(natural, available);
  let left = rect.right - width;
  left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
  const top = placeAbove ? Math.max(8, rect.top - used - gap) : rect.bottom + gap;
  return { top: Math.round(top), left: Math.round(left), maxHeight: Math.round(available) };
}

/** Пиктограммы фильтров и сортировки: каждая открывает панель поверх списка. */
export function ListViewSettings<T>({
  columns,
  filterOptions,
  filters,
  sortRules,
  onApply,
  activeFilterCount,
}: Props<T>) {
  const filterableColumns = columns.filter((c) => c.filterable !== false);
  const sortableColumns = columns.filter((c) => c.sortable !== false);

  const [panel, setPanel] = useState<PanelId | null>(null);
  const [draftFilters, setDraftFilters] = useState<ColumnFilters>({});
  const [draftSortRules, setDraftSortRules] = useState<SortRule[]>([]);
  const [openFilterKey, setOpenFilterKey] = useState<string | null>(null);
  const [pos, setPos] = useState<PopoverPos | null>(null);

  const filterRef = useRef<HTMLSpanElement>(null);
  const sortRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const togglePanel = (next: PanelId) => {
    if (panel === next) {
      setPanel(null);
      return;
    }
    setDraftFilters(cloneFilters(filters));
    setDraftSortRules([...sortRules]);
    setOpenFilterKey(null);
    setPanel(next);
  };

  useLayoutEffect(() => {
    if (!panel) {
      setPos(null);
      return;
    }
    const update = () => {
      const anchor = (panel === 'filters' ? filterRef : sortRef).current;
      const el = panelRef.current;
      if (!anchor || !el) return;
      const next = measurePopover(anchor, el);
      setPos((prev) =>
        prev && prev.top === next.top && prev.left === next.left && prev.maxHeight === next.maxHeight
          ? prev
          : next
      );
    };
    update();
    const onScroll = (event: Event) => {
      const target = event.target;
      if (target instanceof Node && panelRef.current?.contains(target)) return;
      update();
    };
    window.addEventListener('resize', update);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [panel, draftSortRules.length, filterableColumns.length, openFilterKey]);

  useEffect(() => {
    if (!panel) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (filterRef.current?.contains(target) || sortRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest('.searchable-select-panel')) return;
      setPanel(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (document.querySelector('.searchable-select-panel')) return;
      setPanel(null);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [panel]);

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

  const draftFilterCount = Object.keys(draftFilters).length;
  const appliedFilterCount = activeFilterCount;
  const resetFiltersDisabled = draftFilterCount === 0 && appliedFilterCount === 0;
  const resetSortDisabled = draftSortRules.length === 0 && sortRules.length === 0;

  const applyFilters = () => {
    onApply(draftFilters, sortRules);
    setPanel(null);
  };

  const resetFilters = () => {
    onApply({}, sortRules);
    setDraftFilters({});
  };

  const applySort = () => {
    onApply(filters, draftSortRules);
    setPanel(null);
  };

  const resetSort = () => {
    onApply(filters, []);
    setDraftSortRules([]);
  };

  const popover =
    panel &&
    createPortal(
      <div
        ref={panelRef}
        className={`list-popover report-no-print${panel === 'sort' ? ' is-sort' : ''}`}
        role="dialog"
        aria-label={panel === 'filters' ? 'Фильтры' : 'Сортировка'}
        style={
          pos
            ? { top: pos.top, left: pos.left, maxHeight: pos.maxHeight }
            : { top: 0, left: -9999, visibility: 'hidden' }
        }
      >
        {panel === 'filters' ? (
          <>
            <div className="list-popover-head">
              <span className="list-popover-title">Фильтры</span>
              <div className="list-popover-actions">
                <button type="button" className="ghost" onClick={resetFilters} disabled={resetFiltersDisabled}>
                  Сбросить
                </button>
                <button type="button" onClick={applyFilters}>
                  Применить
                </button>
              </div>
            </div>
            <div className="list-popover-body">
              {!filterableColumns.length && <p className="hint">Нет фильтруемых колонок</p>}
              {filterableColumns.map((col) => {
                const selected = getColumnFilter(draftFilters, col.key);
                const opened = openFilterKey === col.key;
                return (
                  <div key={col.key} className="list-popover-filter">
                    <button
                      type="button"
                      className={`list-popover-filter-trigger${opened ? ' is-open' : ''}`}
                      aria-expanded={opened}
                      onClick={() => setOpenFilterKey(opened ? null : col.key)}
                    >
                      <span>{col.label}</span>
                      <span className="list-popover-filter-summary">
                        {selectionLabel(selected)} {opened ? '▴' : '▾'}
                      </span>
                    </button>
                    {opened && (
                      <div className="list-popover-filter-list">
                        <ColumnFilterList
                          options={filterOptions[col.key] || []}
                          selected={selected}
                          onChange={(next) => setDraftFilter(col.key, next)}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <div className="list-popover-head">
              <span className="list-popover-title">Сортировка</span>
              <div className="list-popover-actions">
                <button type="button" className="ghost" onClick={resetSort} disabled={resetSortDisabled}>
                  Сбросить
                </button>
                <button type="button" onClick={applySort}>
                  Применить
                </button>
              </div>
            </div>
            <div className="list-popover-body">
              <p className="hint list-view-settings-hint">
                До {MAX_SORT_LEVELS} уровней: сначала по первому полю, затем по второму.
              </p>
              {!sortableColumns.length && <p className="hint">Нет колонок для сортировки</p>}
              <div className="list-view-sort-rules">
                {draftSortRules.map((rule, index) => (
                  <div key={index} className="list-view-sort-rule">
                    <span className="list-view-sort-index">{index + 1}.</span>
                    <SearchableSelect
                      value={rule.key}
                      allowEmpty={false}
                      onChange={(v) => updateSortRule(index, { key: v })}
                      options={sortableColumns.map((col) => ({ value: col.key, label: col.label }))}
                    />
                    <SearchableSelect
                      value={rule.dir}
                      allowEmpty={false}
                      onChange={(v) => updateSortRule(index, { dir: v as 'asc' | 'desc' })}
                      options={[
                        { value: 'asc', label: 'По возрастанию' },
                        { value: 'desc', label: 'По убыванию' },
                      ]}
                    />
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
            </div>
          </>
        )}
      </div>,
      document.body
    );

  const filterLabel = activeFilterCount ? `Фильтры (${activeFilterCount})` : 'Фильтры';
  const sortLabel = sortRules.length ? `Сортировка (${sortRules.length})` : 'Сортировка';

  return (
    <>
      <span ref={filterRef} className="toolbar-icon-wrap">
        <IconButton
          icon="filter"
          label={filterLabel}
          className="toolbar-icon"
          active={panel === 'filters' || activeFilterCount > 0}
          badge={activeFilterCount}
          aria-haspopup="dialog"
          aria-expanded={panel === 'filters'}
          onClick={() => togglePanel('filters')}
        />
      </span>
      <span ref={sortRef} className="toolbar-icon-wrap">
        <IconButton
          icon="sort"
          label={sortLabel}
          className="toolbar-icon"
          active={panel === 'sort' || sortRules.length > 0}
          badge={sortRules.length}
          aria-haspopup="dialog"
          aria-expanded={panel === 'sort'}
          onClick={() => togglePanel('sort')}
        />
      </span>
      {popover}
    </>
  );
}
