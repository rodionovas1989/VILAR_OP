import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { canCreateObject, canModifyObject, canViewObject } from '../auth/permissions';
import { useAuth } from '../auth/AuthContext';
import { useListTable, ListColumn } from '../hooks/useListTable';
import AccessDenied from './AccessDenied';
import PageTitle from './PageTitle';
import RefreshButton from './RefreshButton';
import { ListViewSettingsButton, ListViewSettingsPanel } from './ListViewSettings';
import ListTableHeader from './ListTableHeader';
import { Modal } from './Modal';
import IconButton from './IconButton';

const PAGE_ID = 'quality_scenarios';
const TYPE_LOT_REGISTERED = 'lot_registered';

type Scope = 'all' | 'selected';

type Scenario = {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  materialScope: Scope;
  materialIds: string[];
  counterpartyScope: Scope;
  counterpartyIds: string[];
  qualityId: string;
  autoPost: boolean;
  comment?: string;
};

type RefItem = { id: string; name?: string; active?: boolean };

const emptyForm = (): Omit<Scenario, 'id'> => ({
  name: '',
  type: TYPE_LOT_REGISTERED,
  enabled: true,
  materialScope: 'selected',
  materialIds: [],
  counterpartyScope: 'all',
  counterpartyIds: [],
  qualityId: '',
  autoPost: true,
  comment: '',
});

function scopeLabel(scope: Scope, ids: string[], names: Map<string, string>) {
  if (scope === 'all') return 'Все';
  if (!ids?.length) return 'Никто (список пуст)';
  const labels = ids.map((id) => names.get(id) || id);
  if (labels.length <= 3) return labels.join(', ');
  return `${labels.slice(0, 3).join(', ')}… (+${labels.length - 3})`;
}

function toggleId(list: string[], id: string) {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

export default function QualityScenariosPage() {
  const { user } = useAuth();
  const canRead = canViewObject(user?.permissions, PAGE_ID);
  const canCreate = canCreateObject(user?.permissions, PAGE_ID);
  const canModify = canModifyObject(user?.permissions, PAGE_ID);

  const [rows, setRows] = useState<Scenario[]>([]);
  const [materials, setMaterials] = useState<RefItem[]>([]);
  const [counterparties, setCounterparties] = useState<RefItem[]>([]);
  const [qualities, setQualities] = useState<RefItem[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [listSettingsOpen, setListSettingsOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());

  const materialNames = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of materials) m.set(r.id, r.name || r.id);
    return m;
  }, [materials]);

  const counterpartyNames = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of counterparties) m.set(r.id, r.name || r.id);
    return m;
  }, [counterparties]);

  const qualityNames = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of qualities) m.set(r.id, r.name || r.id);
    return m;
  }, [qualities]);

  const listColumns = useMemo((): ListColumn<Scenario>[] => {
    return [
      { key: 'name', label: 'Название', getValue: (r) => r.name || '' },
      {
        key: 'enabled',
        label: 'Включён',
        getValue: (r) => (r.enabled ? 'Да' : 'Нет'),
      },
      {
        key: 'materials',
        label: 'Материалы',
        getValue: (r) => scopeLabel(r.materialScope, r.materialIds || [], materialNames),
      },
      {
        key: 'counterparties',
        label: 'Контрагенты',
        getValue: (r) => scopeLabel(r.counterpartyScope, r.counterpartyIds || [], counterpartyNames),
      },
      {
        key: 'qualityId',
        label: 'Качество',
        getValue: (r) => qualityNames.get(r.qualityId) || r.qualityId || '—',
      },
    ];
  }, [materialNames, counterpartyNames, qualityNames]);

  const listTable = useListTable(rows, listColumns, {
    persistKey: PAGE_ID,
    userId: user?.id,
  });

  const load = async () => {
    setBusy(true);
    setError('');
    try {
      const [sc, mats, cps, qs] = await Promise.all([
        api.list<Scenario>('quality_scenarios'),
        api.list<RefItem>('materials'),
        api.list<RefItem>('counterparties'),
        api.list<RefItem>('lot_qualities'),
      ]);
      setRows(sc || []);
      setMaterials(mats || []);
      setCounterparties(cps || []);
      setQualities((qs || []).filter((q) => q.active !== false));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (canRead) load().catch(() => {});
  }, [canRead]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setModalOpen(true);
  };

  const openEdit = (row: Scenario) => {
    setEditingId(row.id);
    setForm({
      name: row.name || '',
      type: row.type || TYPE_LOT_REGISTERED,
      enabled: row.enabled !== false,
      materialScope: row.materialScope === 'all' ? 'all' : 'selected',
      materialIds: [...(row.materialIds || [])],
      counterpartyScope: row.counterpartyScope === 'all' ? 'all' : 'selected',
      counterpartyIds: [...(row.counterpartyIds || [])],
      qualityId: row.qualityId || '',
      autoPost: row.autoPost !== false,
      comment: row.comment || '',
    });
    setModalOpen(true);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const body = { ...form, type: TYPE_LOT_REGISTERED };
      if (editingId) {
        await api.update('quality_scenarios', editingId, body);
      } else {
        await api.create('quality_scenarios', body);
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const remove = async (row: Scenario) => {
    if (!confirm(`Удалить сценарий «${row.name}»?`)) return;
    try {
      await api.remove('quality_scenarios', row.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  if (!canRead) {
    return <AccessDenied title="Сценарии" />;
  }

  return (
    <div className="page">
      <div className="page-toolbar">
        <PageTitle pageId={PAGE_ID} title="Сценарии" />
        <div className="toolbar-actions">
          {canCreate && (
            <button type="button" className="btn primary" onClick={openCreate}>
              Создать
            </button>
          )}
          <ListViewSettingsButton
            open={listSettingsOpen}
            onOpenChange={setListSettingsOpen}
            activeFilterCount={listTable.activeFilterCount}
            sortRulesCount={listTable.sortRules.length}
          />
          <RefreshButton onClick={() => load()} disabled={busy} />
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

      <p className="hint">
        Тип «Регистрация новых партий»: при создании партии (справочник или выпуск ГП) система подбирает
        включённые сценарии по материалу и контрагенту и создаёт документ «Управление качеством» с
        указанным качеством. Пустой список при режиме «Выбранные» = никто. Если по партии уже есть запись
        в регистре качеств — сценарии не запускаются. Несколько подходящих сценариев → несколько
        документов (в регистре останется последний).
      </p>

      {error && !modalOpen && <p className="error">{error}</p>}

      <div className="table-wrap">
        <table className="data-table">
          <ListTableHeader
            columns={listColumns}
            extraHead={canModify ? <th>Действия</th> : undefined}
          />
          <tbody>
            {listTable.displayRows.map((row) => (
              <tr key={row.id}>
                {listColumns.map((col) => (
                  <td key={col.key}>{col.render ? col.render(row) : col.getValue(row)}</td>
                ))}
                {canModify && (
                  <td>
                    <div className="row-actions">
                      <IconButton icon="edit" label="Изменить" onClick={() => openEdit(row)} />
                      <IconButton icon="delete" label="Удалить" onClick={() => remove(row)} />
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {!listTable.displayRows.length && (
              <tr>
                <td colSpan={listColumns.length + (canModify ? 1 : 0)} className="muted">
                  Нет сценариев
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={modalOpen}
        title={editingId ? 'Сценарий' : 'Новый сценарий'}
        onClose={() => setModalOpen(false)}
        wide
      >
        <form className="form-grid scenario-form" onSubmit={save}>
          {error && modalOpen && <p className="error full-width">{error}</p>}
          <label>
            Название
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>

          <label>
            Тип
            <select value={TYPE_LOT_REGISTERED} disabled>
              <option value={TYPE_LOT_REGISTERED}>Регистрация новых партий</option>
            </select>
          </label>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
            />
            Включён
          </label>

          <label>
            Качество (подставится в документ)
            <select
              required
              value={form.qualityId}
              onChange={(e) => setForm({ ...form, qualityId: e.target.value })}
            >
              <option value="">— выберите —</option>
              {qualities.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.name}
                </option>
              ))}
            </select>
          </label>

          <fieldset className="scenario-scope full-width">
            <legend>Материалы</legend>
            <label>
              Область
              <select
                value={form.materialScope}
                onChange={(e) =>
                  setForm({
                    ...form,
                    materialScope: e.target.value as Scope,
                    materialIds: e.target.value === 'all' ? [] : form.materialIds,
                  })
                }
              >
                <option value="all">Все</option>
                <option value="selected">Выбранные</option>
              </select>
            </label>
            {form.materialScope === 'selected' && (
              <div className="scenario-checklist">
                {materials.length === 0 ? (
                  <p className="hint">Нет материалов в справочнике</p>
                ) : (
                  materials.map((m) => (
                    <label key={m.id} className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={form.materialIds.includes(m.id)}
                        onChange={() =>
                          setForm({ ...form, materialIds: toggleId(form.materialIds, m.id) })
                        }
                      />
                      {m.name || m.id}
                    </label>
                  ))
                )}
                {!form.materialIds.length && (
                  <p className="hint">Список пуст — сценарий ни на кого не сработает.</p>
                )}
              </div>
            )}
          </fieldset>

          <fieldset className="scenario-scope full-width">
            <legend>Контрагенты</legend>
            <label>
              Область
              <select
                value={form.counterpartyScope}
                onChange={(e) =>
                  setForm({
                    ...form,
                    counterpartyScope: e.target.value as Scope,
                    counterpartyIds: e.target.value === 'all' ? [] : form.counterpartyIds,
                  })
                }
              >
                <option value="all">Все</option>
                <option value="selected">Выбранные</option>
              </select>
            </label>
            {form.counterpartyScope === 'selected' && (
              <div className="scenario-checklist">
                {counterparties.length === 0 ? (
                  <p className="hint">Нет контрагентов в справочнике</p>
                ) : (
                  counterparties.map((c) => (
                    <label key={c.id} className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={form.counterpartyIds.includes(c.id)}
                        onChange={() =>
                          setForm({
                            ...form,
                            counterpartyIds: toggleId(form.counterpartyIds, c.id),
                          })
                        }
                      />
                      {c.name || c.id}
                    </label>
                  ))
                )}
                {!form.counterpartyIds.length && (
                  <p className="hint">Список пуст — сценарий ни на кого не сработает.</p>
                )}
              </div>
            )}
          </fieldset>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={form.autoPost}
              onChange={(e) => setForm({ ...form, autoPost: e.target.checked })}
            />
            Сразу провести документ управления качеством
          </label>

          <label className="full-width">
            Комментарий к документу
            <textarea
              rows={2}
              value={form.comment || ''}
              onChange={(e) => setForm({ ...form, comment: e.target.value })}
            />
          </label>

          <div className="form-actions full-width">
            <button type="button" className="btn" onClick={() => setModalOpen(false)}>
              Отмена
            </button>
            <button type="submit" className="btn primary">
              Сохранить
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
