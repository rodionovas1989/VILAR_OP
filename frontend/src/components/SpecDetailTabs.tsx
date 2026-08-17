import { useState } from 'react';
import { ApprovedSupplier, SpecLine } from '../types';
import SpecLinesEditor from './SpecLinesEditor';
import SpecSuppliersEditor from './SpecSuppliersEditor';
import SearchableSelect from './SearchableSelect';

type Opt = { id: string; name: string; type?: string };

type Props = {
  editing: Record<string, unknown>;
  setEditing: (row: Record<string, unknown>) => void;
  productMaterials: Opt[];
  materials: Opt[];
  counterparties: Opt[];
  techMaps: Opt[];
  characteristics?: import('../types').LotCharacteristic[];
};

type TabId = 'general' | 'recipe' | 'suppliers';

const SPEC_TYPES = [
  { value: 'Основная', label: 'Основная' },
  { value: 'Альтернативная', label: 'Альтернативная' },
  { value: 'Испытания', label: 'Испытания' },
];

export default function SpecDetailTabs({
  editing,
  setEditing,
  productMaterials,
  materials,
  counterparties,
  techMaps,
  characteristics = [],
}: Props) {
  const [tab, setTab] = useState<TabId>('general');

  const lines = (editing.lines as SpecLine[]) || [];
  const approvedSuppliers = (editing.approvedSuppliers as ApprovedSupplier[]) || [];

  const setField = (key: string, value: string) => {
    setEditing({ ...editing, [key]: value });
  };

  return (
    <div className="spec-detail-tabs">
      <div className="tabs spec-inner-tabs">
        <button type="button" className={tab === 'general' ? 'active' : ''} onClick={() => setTab('general')}>
          Общее
        </button>
        <button type="button" className={tab === 'recipe' ? 'active' : ''} onClick={() => setTab('recipe')}>
          Рецептура
          {lines.length ? ` (${lines.length})` : ''}
        </button>
        <button
          type="button"
          className={tab === 'suppliers' ? 'active' : ''}
          onClick={() => setTab('suppliers')}
        >
          Регистрация поставщиков
          {approvedSuppliers.length ? ` (${approvedSuppliers.length})` : ''}
        </button>
      </div>

      {tab === 'general' && (
        <div className="form-grid spec-general-tab">
          <label>
            <span>Название</span>
            <input
              required
              value={String(editing.name ?? '')}
              onChange={(e) => setField('name', e.target.value)}
            />
          </label>
          <label>
            <span>Продукт</span>
            <SearchableSelect
              required
              value={String(editing.productMaterialId ?? '')}
              onChange={(v) => setField('productMaterialId', v)}
              options={productMaterials.map((m) => ({ value: m.id, label: m.name }))}
            />
          </label>
          <label>
            <span>Тип</span>
            <SearchableSelect
              required
              allowEmpty={false}
              value={String(editing.type ?? 'Основная')}
              onChange={(v) => setField('type', v)}
              options={SPEC_TYPES}
            />
          </label>
          <label>
            <span>Технологическая карта</span>
            <SearchableSelect
              required
              value={String(editing.techMapId ?? '')}
              onChange={(v) => setField('techMapId', v)}
              options={techMaps.map((t) => ({ value: t.id, label: t.name }))}
            />
          </label>
        </div>
      )}

      {tab === 'recipe' && (
        <SpecLinesEditor
          showTitle={false}
          lines={lines}
          materials={materials}
          characteristics={characteristics}
          onChange={(next) => setEditing({ ...editing, lines: next })}
        />
      )}

      {tab === 'suppliers' && (
        <SpecSuppliersEditor
          showTitle={false}
          lines={lines}
          suppliers={approvedSuppliers}
          counterparties={counterparties}
          materials={materials}
          onChange={(next) => setEditing({ ...editing, approvedSuppliers: next })}
        />
      )}
    </div>
  );
}
