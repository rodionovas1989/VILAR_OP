import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { pagePermissionId } from '../auth/navAccess';
import {
  canCreateObject,
  canModifyObject,
  canViewObject,
} from '../auth/permissions';
import { useAuth } from '../auth/AuthContext';
import { useListTable, ListColumn } from '../hooks/useListTable';
import AccessDenied from './AccessDenied';
import IconButton from './IconButton';
import PageTitle from './PageTitle';
import RefreshButton from './RefreshButton';
import { ListViewSettingsButton, ListViewSettingsPanel } from './ListViewSettings';
import { Modal } from './Modal';

export type FieldDef = {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'datetime-local' | 'date' | 'select' | 'textarea' | 'password';
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
  /** ID объекта RBAC; по умолчанию — collection или pagePermissionId(collection) */
  permissionObjectId?: string;
  /** ID страницы навигации для избранного; по умолчанию — collection */
  pageId?: string;
  /** Отключить RBAC (только для служебных страниц) */
  skipAccessCheck?: boolean;
  /** Опции массовой смены статуса */
  bulkStatusOptions?: { value: string; label: string }[];
  /** Не показывать fields в модалке (рендер через formExtra) */
  hideFormFields?: boolean;
  /** Список без кнопок создать/изменить/удалить (регистры, история) */
  readOnly?: boolean;
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
  permissionObjectId,
  pageId: pageIdProp,
  skipAccessCheck,
  hideFormFields,
  readOnly = false,
}: Props) {
  const { user } = useAuth();
  const loggedIn = Boolean(user);
  const objectId = permissionObjectId ?? pagePermissionId(collection);
  const pageId = pageIdProp ?? collection;
  const permissions = user?.permissions;
  const canView = skipAccessCheck || canViewObject(permissions, objectId, loggedIn);
  const canCreate = !readOnly && (skipAccessCheck || canCreateObject(permissions, objectId));
  const canModify = !readOnly && (skipAccessCheck || canModifyObject(permissions, objectId));
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState('');
  const [statusBusy, setStatusBusy] = useState(false);
  const [listSettingsOpen, setListSettingsOpen] = useState(false);

  const listColumns = useMemo((): ListColumn<Record<string, unknown>>[] => {
    return columns.map((col) => ({
      key: col.key,
      label: col.label,
      filterable: col.filterable,
      getValue: (row) => cellText(row, col),
    }));
  }, [columns]);

  const listTable = useListTable(rows, listColumns, {
    persistKey: pageId,
    userId: user?.id,
  });
  const filteredRows = listTable.displayRows;

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.list<Record<string, unknown>>(collection);
      setRows(data);
      setSelected(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [collection]);

  const allChecked = filteredRows.length > 0 && filteredRows.every((r) => selected.has(String(r.id)));

  const openCreate = () => {
    if (!canCreate) return;
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
    if (!canModify) return;
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
    const isNew = !editing.id;
    if (isNew && !canCreate) return;
    if (!isNew && !canModify) return;
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
    if (!selected.size || !canModify) return;
    if (!confirm(`Удалить выбранные (${selected.size})?`)) return;
    await api.bulkDelete(collection, [...selected]);
    await load();
  };

  const openStatusModal = () => {
    if (!selected.size || !bulkStatusOptions?.length || !canModify) return;
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

  if (!canView) {
    return <AccessDenied title={title} />;
  }

  return (
    <div className="page">
      <div className="page-toolbar">
        <PageTitle pageId={pageId} title={title} />
        <div className="toolbar-actions">
          {canCreate && (
            <button type="button" onClick={openCreate}>
              Создать
            </button>
          )}
          {bulkStatusOptions?.length && canModify ? (
            <button type="button" className="ghost" disabled={!selected.size} onClick={openStatusModal}>
              Изменить статус ({selected.size})
            </button>
          ) : null}
          {canModify && (
            <button type="button" className="danger" disabled={!selected.size} onClick={bulkDelete}>
              Удалить выбранные
            </button>
          )}
          <ListViewSettingsButton
            open={listSettingsOpen}
            onOpenChange={setListSettingsOpen}
            activeFilterCount={listTable.activeFilterCount}
            sortRulesCount={listTable.sortRules.length}
          />
          <RefreshButton onClick={load} disabled={loading} />
        </div>
      </div>
      {listSettingsOpen && (
        <ListViewSettingsPanel
          open={listSettingsOpen}
          onClose={() => setListSettingsOpen(false)}
          columns={listColumns}
          filterOptions={listTable.filterOptions}
          filters={listTable.filters}
          sortRules={listTable.sortRules}
          onApply={listTable.applySettings}
          onReset={listTable.resetSettings}
          activeFilterCount={listTable.activeFilterCount}
        />
      )}
      {error && <div className="alert">{error}</div>}
      {loading ? (
        <p>Загрузка…</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
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
                  <th key={c.key}>{c.label}</th>
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
                        {canModify && (
                          <IconButton icon="edit" label="Изменить" onClick={() => openEdit(row)} />
                        )}
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
          {!hideFormFields &&
            formFields.map((f) => {
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
                ) : f.type === 'password' ? (
                  <input
                    type="password"
                    autoComplete="new-password"
                    required={f.required}
                    value={String(editing?.[f.key] ?? '')}
                    onChange={(e) => setField(e.target.value)}
                    placeholder={f.defaultValue as string | undefined}
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
