import { useState } from 'react';
import { LotCharacteristic } from '../types';
import { MATERIAL_TYPES } from '../utils/lotCharacteristics';
import SearchableSelect from './SearchableSelect';
import ToggleSwitch from './ToggleSwitch';

type Props = {
  editing: Record<string, unknown>;
  setEditing: (row: Record<string, unknown>) => void;
  materials: { id: string; name: string; type?: string }[];
};

type TabId = 'general' | 'application';

export default function CharacteristicForm({ editing, setEditing, materials }: Props) {
  const [tab, setTab] = useState<TabId>('general');
  const isSystem = editing.kind === 'system';
  const materialIds = (editing.materialIds as string[]) || [];
  const materialTypes = (editing.materialTypes as string[]) || [];

  const setField = (key: string, value: unknown) => setEditing({ ...editing, [key]: value });

  const toggleType = (type: string) => {
    const next = materialTypes.includes(type)
      ? materialTypes.filter((t) => t !== type)
      : [...materialTypes, type];
    setField('materialTypes', next);
  };

  const toggleMaterial = (id: string) => {
    const next = materialIds.includes(id) ? materialIds.filter((x) => x !== id) : [...materialIds, id];
    setField('materialIds', next);
  };

  return (
    <div className="spec-detail-tabs">
      <div className="tabs spec-inner-tabs">
        <button type="button" className={tab === 'general' ? 'active' : ''} onClick={() => setTab('general')}>
          Основное
        </button>
        <button
          type="button"
          className={tab === 'application' ? 'active' : ''}
          onClick={() => setTab('application')}
        >
          Применение
        </button>
      </div>

      {tab === 'general' && (
        <div className="form-grid spec-general-tab">
          <label>
            <span>Код</span>
            <input
              value={String(editing.code ?? '')}
              disabled={isSystem}
              onChange={(e) => setField('code', e.target.value)}
            />
          </label>
          <label>
            <span>Название</span>
            <input
              value={String(editing.name ?? '')}
              disabled={isSystem}
              onChange={(e) => setField('name', e.target.value)}
            />
            {isSystem ? <span className="muted">Системное название нельзя изменить</span> : null}
          </label>
          <label>
            <span>Вид</span>
            <input value={isSystem ? 'Системная' : 'Пользовательская'} readOnly />
          </label>
          <label>
            <span>Ед.</span>
            <input
              value={String(editing.unit ?? '%')}
              disabled={isSystem}
              onChange={(e) => setField('unit', e.target.value)}
            />
            {isSystem ? <span className="muted">Системную единицу нельзя изменить</span> : null}
          </label>
          <ToggleSwitch
            checked={editing.required === true}
            onCheckedChange={(v) => setField('required', v)}
            label="Обязательная (предупреждение, не запрет)"
          />
          <ToggleSwitch
            checked={editing.active !== false}
            onCheckedChange={(v) => setField('active', v)}
            label="Действует"
          />
          <label className="span-2">
            <span>Комментарий</span>
            <textarea
              value={String(editing.comment ?? '')}
              onChange={(e) => setField('comment', e.target.value)}
            />
          </label>
        </div>
      )}

      {tab === 'application' && (
        <div>
          <p className="hint">
            Пустое применение — никому. Тип материала — массовое включение; конкретный список точнее.
            Пересчёт в спецификации и поля в документе LCH берутся только отсюда: спека сама по себе
            характеристики не добавляет.
          </p>
          <div className="form-grid">
            <div>
              <strong>Типы материалов</strong>
              {MATERIAL_TYPES.map((type) => (
                <ToggleSwitch
                  key={type}
                  className="checkbox-row"
                  checked={materialTypes.includes(type)}
                  onCheckedChange={() => toggleType(type)}
                  label={type}
                />
              ))}
            </div>
            <div>
              <strong>Материалы</strong>
              <SearchableSelect
                value=""
                emptyLabel="Добавить материал…"
                onChange={(v) => v && !materialIds.includes(v) && toggleMaterial(v)}
                options={materials
                  .filter((m) => !materialIds.includes(m.id))
                  .map((m) => ({ value: m.id, label: m.name }))}
              />
              <ul className="chip-list">
                {materialIds.map((id) => (
                  <li key={id}>
                    {materials.find((m) => m.id === id)?.name || id}{' '}
                    <button type="button" className="ghost" onClick={() => toggleMaterial(id)}>
                      ×
                    </button>
                  </li>
                ))}
                {!materialIds.length && <li className="muted">Не выбраны</li>}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function emptyCharacteristic(): Partial<LotCharacteristic> {
  return {
    kind: 'user',
    unit: '%',
    valueType: 'number',
    required: false,
    active: true,
    materialIds: [],
    materialTypes: [],
  };
}
