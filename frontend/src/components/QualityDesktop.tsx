import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { canCreateObject, canViewObject } from '../auth/permissions';
import { useAuth } from '../auth/AuthContext';
import { Counterparty, Lot, LotCharacteristic, Manufacturer, Material } from '../types';
import { characteristicApplies } from '../utils/lotCharacteristics';
import { newId } from '../utils/id';
import { nowTime } from '../utils/docDateTime';
import AccessDenied from './AccessDenied';
import DecimalInput from './DecimalInput';
import IconButton from './IconButton';
import { Modal } from './Modal';
import PageTitle from './PageTitle';
import SearchableSelect from './SearchableSelect';
import ToggleSwitch from './ToggleSwitch';

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
  manufacturers: Manufacturer[];
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

function draftFromRegister(
  lotId: string,
  defs: LotCharacteristic[],
  byLotChar: Map<string, RegisterRow>
): Record<string, number | null> {
  const next: Record<string, number | null> = {};
  for (const d of defs) {
    const row = byLotChar.get(`${lotId}::${d.id}`);
    if (row?.value != null && String(row.value).trim() !== '') {
      const n = Number(row.value);
      next[d.id] = Number.isFinite(n) ? n : null;
    } else {
      next[d.id] = null;
    }
  }
  return next;
}

export default function QualityDesktop({
  materials,
  lots,
  characteristics,
  counterparties,
  manufacturers,
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
  const [filterManufacturerId, setFilterManufacturerId] = useState('');
  const [filterProdFrom, setFilterProdFrom] = useState('');
  const [filterProdTo, setFilterProdTo] = useState('');
  const [filterExpiryFrom, setFilterExpiryFrom] = useState('');
  const [filterExpiryTo, setFilterExpiryTo] = useState('');
  const [selectedMaterialId, setSelectedMaterialId] = useState('');
  const [selectedLotId, setSelectedLotId] = useState('');
  const [draftValues, setDraftValues] = useState<Record<string, number | null>>({});
  const [infoLotId, setInfoLotId] = useState('');
  const [historyRows, setHistoryRows] = useState<HistoryRow[]>([]);
  const [infoBusy, setInfoBusy] = useState(false);

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
      if (filterManufacturerId && lot.manufacturerId !== filterManufacturerId) return false;
      if (filterProdFrom && String(lot.productionDate || '').slice(0, 10) < filterProdFrom) return false;
      if (filterProdTo && String(lot.productionDate || '').slice(0, 10) > filterProdTo) return false;
      if (filterExpiryFrom && String(lot.expiryDate || '').slice(0, 10) < filterExpiryFrom) return false;
      if (filterExpiryTo && String(lot.expiryDate || '').slice(0, 10) > filterExpiryTo) return false;
      const q = filterLotQuery.trim().toLowerCase();
      if (q) {
        const number = String(lot.number || '').toLowerCase();
        const idn = String(lot.identificationNumber || '').toLowerCase();
        if (!number.includes(q) && !idn.includes(q)) return false;
      }
      return true;
    },
    [
      filterMaterialId,
      filterCounterpartyId,
      filterManufacturerId,
      filterLotQuery,
      filterProdFrom,
      filterProdTo,
      filterExpiryFrom,
      filterExpiryTo,
    ]
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
  const formDefs = useMemo(
    () => applicableDefsForMaterial(selectedMaterial, characteristics),
    [selectedMaterial, characteristics]
  );

  // Черновик подтягиваем из регистра только при смене партии (не при каждом рендере / вводе).
  useEffect(() => {
    if (!selectedLotId) {
      setDraftValues({});
      return;
    }
    const mat = materialById.get(lots.find((l) => l.id === selectedLotId)?.materialId || '');
    const defs = applicableDefsForMaterial(mat, characteristics);
    setDraftValues(draftFromRegister(selectedLotId, defs, byLotChar));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- только смена партии
  }, [selectedLotId]);

  const selectMaterial = (id: string) => {
    setSelectedMaterialId(id);
    setSelectedLotId('');
    setDraftValues({});
  };

  const selectLot = (lot: Lot) => {
    setSelectedMaterialId(lot.materialId);
    setSelectedLotId(lot.id);
  };

  const openInfo = async (lotId: string) => {
    setInfoLotId(lotId);
    setInfoBusy(true);
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
      setInfoBusy(false);
    }
  };

  const confirmEntry = async () => {
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
      .filter((v) => v.value != null && Number.isFinite(v.value as number));
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
        comment: primaryEntry
          ? 'Первичный ввод с рабочего стола качества'
          : 'Ввод характеристик с рабочего стола качества',
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
  const mfrName = (id?: string | null) =>
    id ? manufacturers.find((m) => m.id === id)?.name || id : '—';

  const infoLot = lots.find((l) => l.id === infoLotId);
  const infoMaterial = infoLot ? materialById.get(infoLot.materialId) : undefined;
  const infoDefs = applicableDefsForMaterial(infoMaterial, characteristics);

  return (
    <div className="quality-desktop">
      <PageTitle pageId={objectId} title="Рабочий стол качества" />
      <div className="page-toolbar quality-desktop-toolbar">
        <ToggleSwitch
          checked={primaryEntry}
          onCheckedChange={(v) => {
            setPrimaryEntry(v);
            setSelectedLotId('');
            setDraftValues({});
          }}
          label="Первичный ввод характеристик"
        />
        <button type="button" className="ghost" disabled={busy} onClick={() => void loadRegister()}>
          Обновить
        </button>
      </div>
      <p className="hint">
        {primaryEntry
          ? 'Список: партии без значений по применимым характеристикам. Справа — ввод; подтверждение создаёт и проводит LCH.'
          : 'Список: все партии по отборам. Справа — ввод новых значений (поверх текущего регистра); подтверждение создаёт и проводит LCH. Подробности партии — кнопка «?».'}
      </p>

      <div className="quality-desktop-filters">
        <label>
          Материал
          <SearchableSelect
            className="ctrl-like"
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
          Партия
          <input
            className="ctrl"
            type="search"
            value={filterLotQuery}
            placeholder="Номер / ид. номер"
            onChange={(e) => setFilterLotQuery(e.target.value)}
          />
        </label>
        <label>
          Контрагент
          <SearchableSelect
            className="ctrl-like"
            value={filterCounterpartyId}
            onChange={setFilterCounterpartyId}
            emptyLabel="— все —"
            options={counterparties.map((c) => ({ value: c.id, label: c.name }))}
          />
        </label>
        <label>
          Производитель
          <SearchableSelect
            className="ctrl-like"
            value={filterManufacturerId}
            onChange={setFilterManufacturerId}
            emptyLabel="— все —"
            options={manufacturers.map((m) => ({ value: m.id, label: m.name }))}
          />
        </label>
        <label>
          Произведено с
          <input
            className="ctrl"
            type="date"
            value={filterProdFrom}
            onChange={(e) => setFilterProdFrom(e.target.value)}
          />
        </label>
        <label>
          Произведено по
          <input
            className="ctrl"
            type="date"
            value={filterProdTo}
            onChange={(e) => setFilterProdTo(e.target.value)}
          />
        </label>
        <label>
          Годен с
          <input
            className="ctrl"
            type="date"
            value={filterExpiryFrom}
            onChange={(e) => setFilterExpiryFrom(e.target.value)}
          />
        </label>
        <label>
          Годен по
          <input
            className="ctrl"
            type="date"
            value={filterExpiryTo}
            onChange={(e) => setFilterExpiryTo(e.target.value)}
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
                    <th className="col-center" style={{ width: 48 }}></th>
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
                      <td className="col-center" onClick={(e) => e.stopPropagation()}>
                        <IconButton
                          icon="help"
                          label="Информация о партии"
                          onClick={() => void openInfo(lot.id)}
                        />
                      </td>
                    </tr>
                  ))}
                  {!lotsForSelectedMaterial.length && (
                    <tr>
                      <td colSpan={2} className="muted">
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
          <h3>Ввод характеристик</h3>
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
                  {formDefs.map((d) => {
                    const current = byLotChar.get(`${selectedLot.id}::${d.id}`);
                    return (
                      <label key={d.id} className="quality-desktop-field">
                        <span>
                          {d.name}
                          {d.unit ? ` (${d.unit})` : ''}
                          {d.required ? ' *' : ''}
                          {!primaryEntry && hasRegisterValue(current) ? (
                            <span className="muted"> · сейчас {String(current?.value)}</span>
                          ) : null}
                        </span>
                        <DecimalInput
                          min={null}
                          allowEmpty
                          value={draftValues[d.id] ?? null}
                          onValueChange={(value) =>
                            setDraftValues((prev) => ({ ...prev, [d.id]: value }))
                          }
                        />
                      </label>
                    );
                  })}
                </div>
              )}
              <div className="quality-desktop-actions">
                <button type="button" disabled={busy || !formDefs.length} onClick={() => void confirmEntry()}>
                  Подтвердить и провести LCH
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <Modal
        open={Boolean(infoLotId)}
        title={infoLot ? `Партия ${infoLot.number}` : 'Партия'}
        wide
        onClose={() => setInfoLotId('')}
        footer={
          <button type="button" className="ghost" onClick={() => setInfoLotId('')}>
            Закрыть
          </button>
        }
      >
        {!infoLot ? (
          <p className="hint">Партия не найдена</p>
        ) : (
          <>
            <h4 className="quality-info-section">Реквизиты</h4>
            <dl className="quality-info-dl">
              <div>
                <dt>Номер</dt>
                <dd>{infoLot.number}</dd>
              </div>
              <div>
                <dt>Ид. номер</dt>
                <dd>{infoLot.identificationNumber || '—'}</dd>
              </div>
              <div>
                <dt>Материал</dt>
                <dd>{infoMaterial?.name || infoLot.materialId}</dd>
              </div>
              <div>
                <dt>Контрагент</dt>
                <dd>{cpName(infoLot.counterpartyId)}</dd>
              </div>
              <div>
                <dt>Производитель</dt>
                <dd>{mfrName(infoLot.manufacturerId)}</dd>
              </div>
              <div>
                <dt>Дата производства</dt>
                <dd>{String(infoLot.productionDate || '').slice(0, 10) || '—'}</dd>
              </div>
              <div>
                <dt>Срок годности</dt>
                <dd>{String(infoLot.expiryDate || '').slice(0, 10) || '—'}</dd>
              </div>
            </dl>

            <h4 className="quality-info-section">Текущие значения характеристик</h4>
            {infoBusy ? (
              <p className="hint">Загрузка…</p>
            ) : !infoDefs.length ? (
              <p className="hint">Нет применимых характеристик</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Характеристика</th>
                      <th className="num">Значение</th>
                      <th>Документ</th>
                      <th>Обновлено</th>
                    </tr>
                  </thead>
                  <tbody>
                    {infoDefs.map((d) => {
                      const row = byLotChar.get(`${infoLot.id}::${d.id}`);
                      return (
                        <tr key={d.id}>
                          <td>
                            {d.name}
                            {d.unit ? ` (${d.unit})` : ''}
                          </td>
                          <td className="num">
                            {hasRegisterValue(row) ? String(row?.value) : '—'}
                          </td>
                          <td>{row?.documentNumber || '—'}</td>
                          <td>
                            {row?.updatedAt
                              ? String(row.updatedAt).replace('T', ' ').slice(0, 19)
                              : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <h4 className="quality-info-section">История</h4>
            {!historyRows.length ? (
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
          </>
        )}
      </Modal>
    </div>
  );
}
