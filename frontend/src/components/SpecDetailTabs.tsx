import { useState } from 'react';
import { ApprovedSupplier, SpecLine } from '../types';
import SpecLinesEditor from './SpecLinesEditor';
import SpecSuppliersEditor from './SpecSuppliersEditor';

type Opt = { id: string; name: string; type?: string };

type Props = {
  lines: SpecLine[];
  approvedSuppliers: ApprovedSupplier[];
  materials: Opt[];
  counterparties: Opt[];
  onChangeLines: (lines: SpecLine[]) => void;
  onChangeSuppliers: (rows: ApprovedSupplier[]) => void;
};

type TabId = 'recipe' | 'suppliers';

export default function SpecDetailTabs({
  lines,
  approvedSuppliers,
  materials,
  counterparties,
  onChangeLines,
  onChangeSuppliers,
}: Props) {
  const [tab, setTab] = useState<TabId>('recipe');

  return (
    <div className="spec-detail-tabs">
      <div className="tabs spec-inner-tabs">
        <button type="button" className={tab === 'recipe' ? 'active' : ''} onClick={() => setTab('recipe')}>
          Рецептура
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
      {tab === 'recipe' && (
        <SpecLinesEditor lines={lines} materials={materials} onChange={onChangeLines} />
      )}
      {tab === 'suppliers' && (
        <SpecSuppliersEditor
          lines={lines}
          suppliers={approvedSuppliers}
          counterparties={counterparties}
          materials={materials}
          onChange={onChangeSuppliers}
        />
      )}
    </div>
  );
}
