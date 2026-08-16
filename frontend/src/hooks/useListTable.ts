import { ReactNode, useEffect, useMemo, useState } from 'react';

export type ListColumn<T> = {
  key: string;
  label: string;
  /** Отображение и значение для отбора (чекбоксы) */
  getValue: (row: T) => string;
  /**
   * Значение для сортировки и порядка опций в фильтре.
   * Для дат — timestamp или ISO; иначе сортировка по getValue ломается на «01.09» vs «07.08».
   */
  getSortValue?: (row: T) => string | number;
  filterable?: boolean;
  sortable?: boolean;
  render?: (row: T) => ReactNode;
};

export type SortRule = {
  key: string;
  dir: 'asc' | 'desc';
};

export type ColumnFilters = Record<string, Set<string>>;

export const MAX_SORT_LEVELS = 2;

type PersistOptions = {
  persistKey?: string;
  userId?: string | null;
};

type PersistedListState = {
  filters: Record<string, string[]>;
  sortRules: SortRule[];
};

function compareSortValues(a: string | number, b: string | number): number {
  if (typeof a === 'number' && typeof b === 'number') {
    if (a === b) return 0;
    return a < b ? -1 : 1;
  }
  const na = typeof a === 'number' ? a : Number(a);
  const nb = typeof b === 'number' ? b : Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb) && String(a).trim() !== '' && String(b).trim() !== '') {
    if (na === nb) return 0;
    return na < nb ? -1 : 1;
  }
  return String(a).localeCompare(String(b), 'ru', { numeric: true });
}

function sortKeyOf<T>(col: ListColumn<T>, row: T): string | number {
  return col.getSortValue?.(row) ?? col.getValue(row);
}

/** null — без отбора (все значения) */
export function getColumnFilter(filters: ColumnFilters, key: string): Set<string> | null {
  if (!(key in filters)) return null;
  return filters[key];
}

export function cloneFilters(filters: ColumnFilters): ColumnFilters {
  const out: ColumnFilters = {};
  for (const [key, values] of Object.entries(filters)) out[key] = new Set(values);
  return out;
}

function storageKey(userId: string, persistKey: string) {
  return `vilar.list.${userId}.${persistKey}`;
}

function loadPersisted(key: string): { filters: ColumnFilters; sortRules: SortRule[] } | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedListState;
    const filters: ColumnFilters = {};
    if (parsed?.filters && typeof parsed.filters === 'object') {
      for (const [k, v] of Object.entries(parsed.filters)) {
        if (Array.isArray(v)) filters[k] = new Set(v.map(String));
      }
    }
    const sortRules = Array.isArray(parsed?.sortRules)
      ? parsed.sortRules
          .filter(
            (r): r is SortRule =>
              Boolean(r) && typeof r.key === 'string' && (r.dir === 'asc' || r.dir === 'desc')
          )
          .slice(0, MAX_SORT_LEVELS)
      : [];
    return { filters, sortRules };
  } catch {
    return null;
  }
}

export function useListTable<T>(rows: T[], columns: ListColumn<T>[], options?: PersistOptions) {
  const persistKey = options?.persistKey;
  const userId = options?.userId || '';
  const storageId = persistKey && userId ? storageKey(userId, persistKey) : '';

  const [filters, setFilters] = useState<ColumnFilters>({});
  const [sortRules, setSortRules] = useState<SortRule[]>([]);
  const [hydratedFor, setHydratedFor] = useState('');

  useEffect(() => {
    if (!storageId) {
      setHydratedFor('');
      return;
    }
    const saved = loadPersisted(storageId);
    setFilters(saved ? saved.filters : {});
    setSortRules(saved ? saved.sortRules : []);
    setHydratedFor(storageId);
  }, [storageId]);

  useEffect(() => {
    if (!storageId || hydratedFor !== storageId) return;
    const payload: PersistedListState = { filters: {}, sortRules };
    for (const [k, v] of Object.entries(filters)) payload.filters[k] = [...v];
    try {
      localStorage.setItem(storageId, JSON.stringify(payload));
    } catch {
      /* quota / private mode */
    }
  }, [filters, sortRules, storageId, hydratedFor]);

  const filterOptions = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const col of columns) {
      if (col.filterable === false) continue;
      const byDisplay = new Map<string, string | number>();
      for (const row of rows) {
        const display = col.getValue(row);
        if (!byDisplay.has(display)) byDisplay.set(display, sortKeyOf(col, row));
      }
      map[col.key] = [...byDisplay.entries()]
        .sort((a, b) => compareSortValues(a[1], b[1]))
        .map(([display]) => display);
    }
    return map;
  }, [rows, columns]);

  const displayRows = useMemo(() => {
    let list = rows.filter((row) =>
      columns.every((col) => {
        if (col.filterable === false) return true;
        if (!(col.key in filters)) return true;
        const sel = filters[col.key];
        if (sel.size === 0) return false;
        return sel.has(col.getValue(row));
      })
    );
    if (sortRules.length) {
      list = [...list].sort((a, b) => {
        for (const rule of sortRules) {
          const col = columns.find((c) => c.key === rule.key);
          if (!col || col.sortable === false) continue;
          const cmp = compareSortValues(sortKeyOf(col, a), sortKeyOf(col, b));
          if (cmp !== 0) return rule.dir === 'asc' ? cmp : -cmp;
        }
        return 0;
      });
    }
    return list;
  }, [rows, columns, filters, sortRules]);

  const setColumnFilter = (key: string, next: Set<string> | null) => {
    setFilters((prev) => {
      const copy = { ...prev };
      if (next === null) delete copy[key];
      else copy[key] = next;
      return copy;
    });
  };

  const applySettings = (nextFilters: ColumnFilters, nextSortRules: SortRule[]) => {
    setFilters(cloneFilters(nextFilters));
    setSortRules([...nextSortRules]);
  };

  const resetSettings = () => {
    setFilters({});
    setSortRules([]);
  };

  const activeFilterCount = useMemo(() => Object.keys(filters).length, [filters]);

  const hasActiveSettings = activeFilterCount > 0 || sortRules.length > 0;

  return {
    displayRows,
    filters,
    setColumnFilter,
    sortRules,
    setSortRules,
    applySettings,
    filterOptions,
    resetSettings,
    activeFilterCount,
    hasActiveSettings,
  };
}
