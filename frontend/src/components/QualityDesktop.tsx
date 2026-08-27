import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { canCreateObject, canViewObject } from '../auth/permissions';
import { useAuth } from '../auth/AuthContext';
import { Counterparty, Lot, LotCharacteristic, Material } from '../types';
import { characteristicApplies } from '../utils/lotCharacteristics';
import { newId } from '../utils/id';
import { nowTime } from '../utils/docDateTime';
import AccessDenied from './AccessDenied';
import DecimalInput from './DecimalInput';
import { Modal } from './Modal';
import PageTitle from './PageTitle';
import SearchableSelect from './SearchableSelect';

type RegisterRow = {
  id: string;
  lotId: string;
  materialId: string;
  characteristicId: string;
  value?: number | string | null;
  code?: string;
  name?: string;
  unit?: string;
  updatedAt?: string;
  documentNumber?: string;
};

type HistoryRow = {
  id: string;
  at?: string;
  action?: string;
  lotId?: string;
  materialId?: string;
  characteristicId?: string;
  code?: string;
  name?: string;
  unit?: string;
  value?: number | string | null;
  documentNumber?: string;
};

type Props = {
  materials: Material[];
  lots: Lot[];
  characteristics: LotCharacteristic[];
  counterparties: Counterparty[];
};

function hasRegisterValue(row: RegisterRow | undefined): boolean {
  if (!row) return false;
  const v = row.value;
  return v != null && String(v).trim() !== '';
}

/** Партия без ни одного значения по применимым характеристикам. */
function lotHasNoApplicableValues(
  lot: Lot,
  material: Material | undefined,
  defs: LotCharacteristic[],
  byLotChar: Map<string, RegisterRow>
): boolean {
  if (!material) return false;
  const applicable = defs.filter((d) => characteristicApplies(d, material));
  if (!applicable.length) return false;
  return applicable.every((d) => !hasRegisterValue(byLotChar.get(`${lot.id}::${d.id}`)));
}

function applicableDefsForMaterial(
  material: Material | undefined,
  defs: LotCharacteristic[]
): LotCharacteristic[] {
  if (!material) return [];
  return defs.filter((d) => characteristicApplies(d, material));
}

export default function QualityDesktop({
  materials,
  lots,
  characteristics,
  counterparties,
}: Props) {
  const { user, openLogin } = useAuth();
  const objectId = 'quality_desktop';
  const permissions = user?.permissions;
  const loggedIn = Boolean(user);

  const [primaryEntry, setPrimaryEntry] = useState(true);
  const [register, setRegister] = useState<RegisterRow[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [filterMaterialId, setFilterMaterialId] = useState('');
  const [filterLotQuery, setFilterLotQuery] = useState('');
  const [filterCounterpartyId, setFilterCounterpartyId] = useState('');
  const [selectedMaterialId, setSelectedMaterialId] = useState('');
  const [selectedLotId, setSelectedLotId] = useState('');
  const [draftValues, setDraftValues] = useState<Record<string, number | null>>({});
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyRows, setHistoryRows] = useState<HistoryRow[]>([]);
  const [historyBusy, setHistoryBusy] = useState(false);

  const loadRegister = useCallback(async () => {
    const rows = await api.list<RegisterRow>('characteristic_register');
    setRegister(rows);
  }, []);

  useEffect(() => {
    loadRegister().catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [loadRegister]);

  const byLotChar = useMemo(() => {
    const m = new Map<string, RegisterRow>();
    for (const r of register) {
      m.set(`${r.lotId}::${r.characteristicId}`, r);
    }
    return m;
  }, [register]);

  const materialById = useMemo(() => new Map(materials.map((m) => [m.id, m])), [materials]);

  const lotMatchesFilters = useCallback(
    (lot: Lot) => {
      if (filterMaterialId && lot.materialId !== filterMaterialId) return false;
      if (filterCounterpartyId && lot.counterpartyId !== filterCounterpartyId) return false;
      const q = filterLotQuery.trim().toLowerCase();
      if (q) {
        const number = String(lot.number || '').toLowerCase();
        const idn = String(lot.identificationNumber || '').toLowerCase();
        if (!number.includes(q) && !idn.includes(q) && !number.startsWith(q)) return false;
      }
      return true;
    },
    [filterMaterialId, filterCounterpartyId, filterLotQuery]
  );

  const candidateLots = useMemo(() => {
    return lots.filter((lot) => {
      if (!lotMatchesFilters(lot)) return false;
      const mat = materialById.get(lot.materialId);
      const applicable = applicableDefsForMaterial(mat, characteristics);
      if (!applicable.length) return false;
      if (primaryEntry) {
        return lotHasNoApplicableValues(lot, mat, characteristics, byLotChar);
      }
      return true;
    });
  }, [lots, lotMatchesFilters, materialById, characteristics, primaryEntry, byLotChar]);

  const candidateMaterials = useMemo(() => {
    const ids = new Set(candidateLots.map((l) => l.materialId));
    return materials
      .filter((m) => ids.has(m.id))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }, [candidateLots, materials]);

  const lotsForSelectedMaterial = useMemo(() => {
    const mid = selectedMaterialId || filterMaterialId;
    const list = mid ? candidateLots.filter((l) => l.materialId === mid) : candidateLots;
    return [...list].sort((a, b) => String(a.number).localeCompare(String(b.number), 'ru'));
  }, [candidateLots, selectedMaterialId, filterMaterialId]);

  useEffect(() => {
    if (selectedMaterialId && !candidateMaterials.some((m) => m.id === selectedMaterialId)) {
      setSelectedMaterialId('');
      setSelectedLotId('');
      setDraftValues({});
    }
  }, [candidateMaterials, selectedMaterialId]);

  useEffect(() => {
    if (selectedLotId && !lotsForSelectedMaterial.some((l) => l.id === selectedLotId)) {
      setSelectedLotId('');
      setDraftValues({});
    }
  }, [lotsForSelectedMaterial, selectedLotId]);

  const selectedLot = lots.find((l) => l.id === selectedLotId);
  const selectedMaterial =
    materialById.get(selectedLot?.materialId || selectedMaterialId || '') || undefined;
  const formDefs = applicableDefsForMaterial(selectedMaterial, characteristics);

  useEffect(() => {
    if (!selectedLotId || !formDefs.length) {
      setDraftValues({});
      return;
    }
    const next: Record<string, number | null> = {};
    for (const d of formDefs) {
      const row = byLotChar.get(`${selectedLotId}::${d.id}`);
      if (row?.value != null && String(row.value).trim() !== '') {
        const n = Number(row.value);
        next[d.id] = Number.isFinite(n) ? n : null;
      } else {
        next[d.id] = null;
      }
    }
    setDraftValues(next);
  }, [selectedLotId, formDefs, byLotChar]);

  const selectMaterial = (id: string) => {
    setSelectedMaterialId(id);
    setSelectedLotId('');
    setDraftValues({});
  };

  const selectLot = (lot: Lot) => {
    setSelectedMaterialId(lot.materialId);
    setSelectedLotId(lot.id);
  };

  const openHistory = async (lotId: string) => {
    setHistoryOpen(true);
    setHistoryBusy(true);
    try {
      const rows = await api.list<HistoryRow>('characteristic_history');
      setHistoryRows(
        rows
          .filter((r) => r.lotId === lotId)
          .sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')))
      );
    } catch (e) {
      setHistoryRows([]);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setHistoryBusy(false);
    }
  };

  const confirmPrimary = async () => {
    if (!loggedIn) {
      openLogin();
      return;
    }
    if (!canCreateObject(permissions, 'characteristic_documents')) {
      window.alert('Недостаточно прав на создание документов характеристик.');
      return;
    }
    if (!selectedLot || !selectedMaterial) {
      setError('Выберите партию');
      return;
    }
    const values = formDefs
      .map((d) => ({
        characteristicId: d.id,
        value: draftValues[d.id],
      }))
      .filter((v) => v.value != null && Number.isFinite(v.value));
    if (!values.length) {
      setError('Укажите хотя бы одно значение характеристики');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const created = await api.createCharacteristicDocument({
        date: new Date().toISOString().slice(0, 10),
        time: nowTime(),
        comment: 'Первичный ввод с рабочего стола качества',
        createdByUserId: user?.id,
        lines: [
          {
            id: newId(),
            materialId: selectedMaterial.id,
            lotId: selectedLot.id,
            values,
          },
        ],
      });
      await api.postCharacteristicDocument(created.id);
      await loadRegister();
      setSelectedLotId('');
      setDraftValues({});
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!canViewObject(permissions, objectId, loggedIn)) {
    return <AccessDenied title="Рабочий стол качества" />;
  }

  const cpName = (id?: string | null) =>
    id ? counterparties.find((c) => c.id === id)?.name || id : '—';

  return (
    <div className="quality-desktop">
      <PageTitle pageId={objectId} title="Рабочий стол качества" />
      <div className="page-toolbar quality-desktop-toolbar">
        <label className="suggest-only-problems">
          <input
            type="checkbox"
            checked={primaryEntry}
            onChange={(e) => {
              setPrimaryEntry(e.target.checked);
              setSelectedLotId('');
              setDraftValues({});
            }}
          />{' '}
          Первичный ввод характеристик
        </label>
        <button type="button" className="ghost" disabled={busy} onClick={() => void loadRegister()}>
          Обновить
        </button>
      </div>
      <p className="hint">
        {primaryEntry
          ? 'Показаны материалы и партии, у которых ещё нет ни одного значения по применимым характеристикам. Подтверждение создаёт и проводит документ LCH.'
          : 'Все партии по отборам (с применимыми характеристиками). Актуальные значения — из регистра; история — по кнопке «i».'}
      </p>

      <div className="quality-desktop-filters">
        <label>
          Материал{' '}
          <SearchableSelect
            value={filterMaterialId}
            onChange={(v) => {
              setFilterMaterialId(v);
              if (v) setSelectedMaterialId(v);
            }}
            emptyLabel="— все —"
            options={materials
              .filter((m) => applicableDefsForMaterial(m, characteristics).length > 0)
              .map((m) => ({ value: m.id, label: m.name }))}
          />
        </label>
        <label>
          Партия{' '}
          <input
            type="search"
            value={filterLotQuery}
            placeholder="Номер / ид. номер"
            onChange={(e) => setFilterLotQuery(e.target.value)}
          />
        </label>
        <label>
          Контрагент{' '}
          <SearchableSelect
            value={filterCounterpartyId}
            onChange={setFilterCounterpartyId}
            emptyLabel="— все —"
            options={counterparties.map((c) => ({ value: c.id, label: c.name }))}
          />
        </label>
      </div>

      {error ? <p className="alert error">{error}</p> : null}

      <div className="quality-desktop-grid">
        <div className="quality-desktop-lists">
          <div className="quality-desktop-panel">
            <h3>Материалы ({candidateMaterials.length})</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Наименование</th>
                    <th>Тип</th>
                  </tr>
                </thead>
                <tbody>
                  {candidateMaterials.map((m) => (
                    <tr
                      key={m.id}
                      className={selectedMaterialId === m.id ? 'row-selected' : undefined}
                      onClick={() => selectMaterial(m.id)}
                    >
                      <td>{m.name}</td>
                      <td className="muted">{m.type || '—'}</td>
                    </tr>
                  ))}
                  {!candidateMaterials.length && (
                    <tr>
                      <td colSpan={2} className="muted">
                        Нет материалов по отбору
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="quality-desktop-panel">
            <h3>Партии ({lotsForSelectedMaterial.length})</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Номер</th>
                    <th>Контрагент</th>
                    {!primaryEntry ? <th></th> : null}
                  </tr>
                </thead>
                <tbody>
                  {lotsForSelectedMaterial.map((lot) => (
                    <tr
                      key={lot.id}
                      className={selectedLotId === lot.id ? 'row-selected' : undefined}
                      onClick={() => selectLot(lot)}
                    >
                      <td>{lot.number}</td>
                      <td className="muted">{cpName(lot.counterpartyId)}</td>
                      {!primaryEntry ? (
                        <td className="col-center">
                          <button
                            type="button"
                            className="icon-square-btn"
                            title="История характеристик"
                            aria-label="История характеристик"
                            onClick={(e) => {
                              e.stopPropagation();
                              void openHistory(lot.id);
                            }}
                          >
                            <span className="icon-square-btn-glyph" aria-hidden>
                              i
                            </span>
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                  {!lotsForSelectedMaterial.length && (
                    <tr>
                      <td colSpan={primaryEntry ? 2 : 3} className="muted">
                        Нет партий по отбору
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="quality-desktop-form quality-desktop-panel">
          <h3>{primaryEntry ? 'Ввод характеристик' : 'Текущие значения'}</h3>
          {!selectedLot ? (
            <p className="hint">Выберите партию слева</p>
          ) : (
            <>
              <p>
                <strong>{selectedMaterial?.name}</strong>
                <span className="muted"> · партия {selectedLot.number}</span>
              </p>
              {!formDefs.length ? (
                <p className="hint">Для материала нет применимых характеристик</p>
              ) : (
                <div className="quality-desktop-fields">
                  {formDefs.map((d) => (
                    <label key={d.id} className="quality-desktop-field">
                      <span>
                        {d.name}
                        {d.unit ? ` (${d.unit})` : ''}
                        {d.required ? ' *' : ''}
                      </span>
                      {primaryEntry ? (
                        <DecimalInput
                          min={null}
                          allowEmpty
                          value={draftValues[d.id] ?? null}
                          onValueChange={(value) =>
                            setDraftValues((prev) => ({ ...prev, [d.id]: value }))
                          }
                        />
                      ) : (
                        <span className="quality-desktop-readonly">
                          {draftValues[d.id] != null ? String(draftValues[d.id]) : '—'}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              )}
              {primaryEntry ? (
                <div className="quality-desktop-actions">
                  <button type="button" disabled={busy || !formDefs.length} onClick={() => void confirmPrimary()}>
                    Подтвердить и провести LCH
                  </button>
                </div>
              ) : (
                <p className="hint">
                  Изменение значений — через документ «Управление характеристиками». История — кнопка «i» у партии.
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <Modal
        open={historyOpen}
        title="История характеристик"
        wide
        onClose={() => setHistoryOpen(false)}
        footer={
          <button type="button" className="ghost" onClick={() => setHistoryOpen(false)}>
            Закрыть
          </button>
        }
      >
        {historyBusy ? (
          <p className="hint">Загрузка…</p>
        ) : !historyRows.length ? (
          <p className="hint">Записей нет</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Когда</th>
                  <th>Действие</th>
                  <th>Характеристика</th>
                  <th className="num">Значение</th>
                  <th>Документ</th>
                </tr>
              </thead>
              <tbody>
                {historyRows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.at ? String(r.at).replace('T', ' ').slice(0, 19) : '—'}</td>
                    <td>{r.action || '—'}</td>
                    <td>{r.name || r.code || r.characteristicId}</td>
                    <td className="num">{r.value != null ? String(r.value) : '—'}</td>
                    <td>{r.documentNumber || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
}
