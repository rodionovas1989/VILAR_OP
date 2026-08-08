import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { Modal } from './Modal';

export type FieldDef = {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'datetime-local' | 'date' | 'select' | 'textarea';
  options?: { value: string; label: string }[];
  required?: boolean;
};

type Props = {
  title: string;
  collection: string;
  fields: FieldDef[];
  columns: { key: string; label: string; render?: (row: Record<string, unknown>) => string }[];
  transformIn?: (row: Record<string, unknown>) => Record<string, unknown>;
  transformOut?: (row: Record<string, unknown>) => Record<string, unknown>;
  rowActions?: (row: Record<string, unknown>, reload: () => void) => ReactNode;
};

function toLocalInput(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CrudPage({ title, collection, fields, columns, transformIn, transformOut, rowActions }: Props) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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

  const allChecked = rows.length > 0 && selected.size === rows.length;

  const openCreate = () => {
    const blank: Record<string, unknown> = {};
    fields.forEach((f) => {
      blank[f.key] = f.type === 'number' ? 0 : '';
    });
    setEditing(blank);
  };

  const openEdit = (row: Record<string, unknown>) => {
    const base = transformIn ? transformIn({ ...row }) : { ...row };
    fields.forEach((f) => {
      if (f.type === 'datetime-local' && typeof base[f.key] === 'string') {
        base[f.key] = toLocalInput(base[f.key] as string);
      }
    });
    setEditing(base);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    try {
      let body = { ...editing };
      delete body.id;
      fields.forEach((f) => {
        if (f.type === 'number') body[f.key] = Number(body[f.key]);
        if (f.type === 'datetime-local' && body[f.key]) {
          body[f.key] = new Date(String(body[f.key])).toISOString();
        }
      });
      if (transformOut) body = transformOut(body);
      if (editing.id) await api.update(collection, String(editing.id), body);
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

  const formFields = useMemo(() => fields, [fields]);

  return (
    <div className="page">
      <div className="page-toolbar">
        <h1>{title}</h1>
        <div className="toolbar-actions">
          <button type="button" onClick={openCreate}>
            Создать
          </button>
          <button type="button" className="danger" disabled={!selected.size} onClick={bulkDelete}>
            Удалить выбранные
          </button>
          <button type="button" className="ghost" onClick={load}>
            Обновить
          </button>
        </div>
      </div>
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
                      setSelected(e.target.checked ? new Set(rows.map((r) => String(r.id))) : new Set());
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
              {rows.map((row) => {
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
                    <td className="row-actions">
                      <button type="button" className="link" onClick={() => openEdit(row)}>
                        Изменить
                      </button>
                      {rowActions?.(row, load)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={!!editing}
        title={editing?.id ? `Редактирование — ${title}` : `Создание — ${title}`}
        onClose={() => setEditing(null)}
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
          {formFields.map((f) => (
            <label key={f.key}>
              <span>{f.label}</span>
              {f.type === 'select' ? (
                <select
                  required={f.required}
                  value={String(editing?.[f.key] ?? '')}
                  onChange={(e) => setEditing({ ...editing!, [f.key]: e.target.value })}
                >
                  <option value="">—</option>
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : f.type === 'textarea' ? (
                <textarea
                  value={String(editing?.[f.key] ?? '')}
                  onChange={(e) => setEditing({ ...editing!, [f.key]: e.target.value })}
                />
              ) : (
                <input
                  type={f.type || 'text'}
                  required={f.required}
                  value={String(editing?.[f.key] ?? '')}
                  onChange={(e) => setEditing({ ...editing!, [f.key]: e.target.value })}
                />
              )}
            </label>
          ))}
        </form>
      </Modal>
    </div>
  );
}
