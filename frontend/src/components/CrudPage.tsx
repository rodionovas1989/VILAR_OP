import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import ColumnFilterDropdown from './ColumnFilterDropdown';
import IconButton from './IconButton';
import { Modal } from './Modal';

export type FieldDef = {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'datetime-local' | 'date' | 'select' | 'textarea';
  options?: { value: string; label: string }[];
  /** Динамические options с учётом текущей формы (например, спецификации по продукту) */
  optionsFor?: (editing: Record<string, unknown>) => { value: string; label: string }[];
  /** При изменении этого поля сбросить зависимые */
  resets?: string[];
  required?: boolean;
  /** Значение при создании новой записи */
  defaultValue?: string | number;
  hint?: string | ((editing: Record<string, unknown>) => string | null);
  /** Доп. поля при изменении (подстановка количества и т.п.) */
  patchOnChange?: (
    value: string,
    editing: Record<string, unknown>
  ) => Record<string, unknown>;
};

export type ColumnDef = {
  key: string;
  label: string;
  render?: (row: Record<string, unknown>) => string;
  /** По умолчанию true — отбор чекбоксами в шапке */
  filterable?: boolean;
};

type Props = {
  title: string;
  collection: string;
  fields: FieldDef[];
  columns: ColumnDef[];
  transformIn?: (row: Record<string, unknown>) => Record<string, unknown>;
  transformOut?: (row: Record<string, unknown>) => Record<string, unknown>;
  rowActions?: (row: Record<string, unknown>, reload: () => void) => ReactNode;
  formExtra?: (ctx: {
    editing: Record<string, unknown>;
    setEditing: (row: Record<string, unknown>) => void;
  }) => ReactNode;
  wideModal?: boolean;
  /** Доп. проверка перед сохранением; вернуть текст ошибки или null */
  validate?: (row: Record<string, unknown>) => string | null;
  /** Если задано — кнопка «Изменить статус» для выбранных строк */
  bulkStatusOptions?: { value: string; label: string }[];
};

function toLocalInput(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function cellText(row: Record<string, unknown>, col: ColumnDef) {
  return col.render ? col.render(row) : String(row[col.key] ?? '');
}

export function CrudPage({
  title,
  collection,
  fields,
  columns,
  transformIn,
  transformOut,
  rowActions,
  formExtra,
  wideModal,
  validate,
  bulkStatusOptions,
}: Props) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState('');
  const [statusBusy, setStatusBusy] = useState(false);
  /** key колонки → выбранные значения (пусто = все) */
  const [filters, setFilters] = useState<Record<string, Set<string>>>({});
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const tableHeadRef = useRef<HTMLTableSectionElement>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.list<Record<string, unknown>>(collection);
      setRows(data);
      setSelected(new Set());
      setFilters({});
      setOpenFilter(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [collection]);

  useEffect(() => {
    if (!openFilter) return;
    const onDoc = (e: MouseEvent) => {
      if (!tableHeadRef.current?.contains(e.target as Node)) setOpenFilter(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenFilter(null);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [openFilter]);

  const filterOptions = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const col of columns) {
      if (col.filterable === false) continue;
      const vals = new Set<string>();
      for (const row of rows) vals.add(cellText(row, col));
      map[col.key] = [...vals].sort((a, b) => a.localeCompare(b, 'ru'));
    }
    return map;
  }, [rows, columns]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) =>
      columns.every((col) => {
        if (col.filterable === false) return true;
        const sel = filters[col.key];
        if (!sel || sel.size === 0) return true;
        return sel.has(cellText(row, col));
      })
    );
  }, [rows, columns, filters]);

  const allChecked = filteredRows.length > 0 && filteredRows.every((r) => selected.has(String(r.id)));

  const openCreate = () => {
    const blank: Record<string, unknown> = {};
    fields.forEach((f) => {
      if (f.defaultValue !== undefined) blank[f.key] = f.defaultValue;
      else blank[f.key] = f.type === 'number' ? 0 : '';
    });
    blank.lines = [];
    blank.approvedSuppliers = [];
    setEditing(blank);
  };

  const openEdit = (row: Record<string, unknown>) => {
    const base = transformIn ? transformIn({ ...row }) : { ...row };
    fields.forEach((f) => {
      if (f.type === 'datetime-local' && typeof base[f.key] === 'string') {
        base[f.key] = toLocalInput(base[f.key] as string);
      }
    });
    if (!Array.isArray(base.lines)) base.lines = [];
    if (!Array.isArray(base.approvedSuppliers)) base.approvedSuppliers = [];
    setEditing(base);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    try {
      let body = { ...editing };
      const editingId = editing.id ? String(editing.id) : undefined;
      delete body.id;
      fields.forEach((f) => {
        if (f.type === 'number') body[f.key] = Number(body[f.key]);
        if (f.type === 'datetime-local' && body[f.key]) {
          body[f.key] = new Date(String(body[f.key])).toISOString();
        }
      });
      if (transformOut) body = transformOut(body);
      const invalid = validate?.(editingId ? { ...body, id: editingId } : body);
      if (invalid) {
        setError(invalid);
        return;
      }
      if (editingId) await api.update(collection, editingId, body);
      else await api.create(collection, body);
      setEditing(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const bulkDelete = async () => {
    if (!selected.size) return;
    if (!confirm(`Удалить выбранные (${selected.size})?`)) return;
    await api.bulkDelete(collection, [...selected]);
    await load();
  };

  const openStatusModal = () => {
    if (!selected.size || !bulkStatusOptions?.length) return;
    setBulkStatus(bulkStatusOptions[0].value);
    setStatusModalOpen(true);
  };

  const applyBulkStatus = async () => {
    if (!selected.size || !bulkStatus) return;
    setStatusBusy(true);
    setError('');
    try {
      const ids = [...selected];
      for (const id of ids) {
        await api.update(collection, id, { status: bulkStatus });
      }
      setStatusModalOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setStatusBusy(false);
    }
  };

  const formFields = useMemo(() => fields, [fields]);

  const setColumnFilter = (key: string, next: Set<string>) => {
    setFilters((prev) => ({ ...prev, [key]: next }));
  };

  return (
    <div className="page">
      <div className="page-toolbar">
        <h1>{title}</h1>
        <div className="toolbar-actions">
          <button type="button" onClick={openCreate}>
            Создать
          </button>
          {bulkStatusOptions?.length ? (
            <button type="button" className="ghost" disabled={!selected.size} onClick={openStatusModal}>
              Изменить статус ({selected.size})
            </button>
          ) : null}
          <button type="button" className="danger" disabled={!selected.size} onClick={bulkDelete}>
            Удалить выбранные
          </button>
          <IconButton icon="refresh" label="Обновить" tone="muted" onClick={load} />
        </div>
      </div>
      {error && <div className="alert">{error}</div>}
      {loading ? (
        <p>Загрузка…</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead ref={tableHeadRef}>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={(e) => {
                      setSelected(
                        e.target.checked ? new Set(filteredRows.map((r) => String(r.id))) : new Set()
                      );
                    }}
                  />
                </th>
                {columns.map((c) => (
                  <th key={c.key}>
                    <div className="th-with-filter">
                      <span className="th-label">{c.label}</span>
                      {c.filterable !== false && (
                        <ColumnFilterDropdown
                          title={c.label}
                          options={filterOptions[c.key] || []}
                          selected={filters[c.key] || new Set()}
                          onChange={(next) => setColumnFilter(c.key, next)}
                          open={openFilter === c.key}
                          onOpenChange={(o) => setOpenFilter(o ? c.key : null)}
                        />
                      )}
                    </div>
                  </th>
                ))}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => {
                const id = String(row.id);
                return (
                  <tr key={id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.has(id)}
                        onChange={(e) => {
                          const next = new Set(selected);
                          if (e.target.checked) next.add(id);
                          else next.delete(id);
                          setSelected(next);
                        }}
                      />
                    </td>
                    {columns.map((c) => (
                      <td key={c.key}>{c.render ? c.render(row) : String(row[c.key] ?? '')}</td>
                    ))}
                    <td>
                      <div className="row-actions">
                        <IconButton icon="edit" label="Изменить" onClick={() => openEdit(row)} />
                        {rowActions?.(row, load)}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!filteredRows.length && (
                <tr>
                  <td colSpan={columns.length + 2} className="muted">
                    Нет записей по выбранным отборам
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={!!editing}
        title={editing?.id ? `Редактирование — ${title}` : `Создание — ${title}`}
        onClose={() => setEditing(null)}
        wide={wideModal}
        footer={
          <>
            <button type="button" className="ghost" onClick={() => setEditing(null)}>
              Отмена
            </button>
            <button type="submit" form="crud-form">
              Сохранить
            </button>
          </>
        }
      >
        <form id="crud-form" onSubmit={onSubmit} className="form-grid">
          {formFields.map((f) => {
            const selectOptions = f.optionsFor && editing ? f.optionsFor(editing) : f.options || [];
            const setField = (value: string | number) => {
              const next: Record<string, unknown> = { ...editing!, [f.key]: value };
              (f.resets || []).forEach((k) => {
                next[k] = '';
              });
              if (f.patchOnChange) {
                Object.assign(next, f.patchOnChange(String(value), next));
              }
              setEditing(next);
            };
            return (
              <label key={f.key}>
                <span>{f.label}</span>
                {f.type === 'select' ? (
                  <select
                    required={f.required}
                    value={String(editing?.[f.key] ?? '')}
                    onChange={(e) => setField(e.target.value)}
                    disabled={!!f.optionsFor && !selectOptions.length && !editing?.[f.key]}
                  >
                    <option value="">—</option>
                    {selectOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : f.type === 'textarea' ? (
                  <textarea
                    value={String(editing?.[f.key] ?? '')}
                    onChange={(e) => setField(e.target.value)}
                  />
                ) : (
                  <input
                    type={f.type || 'text'}
                    required={f.required}
                    value={String(editing?.[f.key] ?? '')}
                    onChange={(e) => setField(e.target.value)}
                  />
                )}
                {(() => {
                  if (!editing || !f.hint) return null;
                  const text = typeof f.hint === 'function' ? f.hint(editing) : f.hint;
                  return text ? <span className="field-hint">{text}</span> : null;
                })()}
              </label>
            );
          })}
          {editing && formExtra?.({ editing, setEditing })}
        </form>
      </Modal>

      <Modal
        open={statusModalOpen}
        title="Изменить статус"
        onClose={() => !statusBusy && setStatusModalOpen(false)}
        footer={
          <>
            <button type="button" className="ghost" disabled={statusBusy} onClick={() => setStatusModalOpen(false)}>
              Отмена
            </button>
            <button type="button" disabled={statusBusy || !bulkStatus} onClick={applyBulkStatus}>
              Применить к выбранным ({selected.size})
            </button>
          </>
        }
      >
        <div className="form-grid">
          <p className="hint" style={{ margin: 0 }}>
            Новый статус будет установлен для всех отмеченных записей ({selected.size}). Для «завершен» /
            «отменен» сработают складские правила (списание / снятие резервов).
          </p>
          <label>
            <span>Статус</span>
            <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)} disabled={statusBusy}>
              {(bulkStatusOptions || []).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Modal>
    </div>
  );
}
