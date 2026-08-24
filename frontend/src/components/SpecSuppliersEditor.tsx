import { ApprovedSupplier, SpecLine } from '../types';
import IconButton from './IconButton';
import SearchableSelect from './SearchableSelect';

type Opt = { id: string; name: string };

type Props = {
  lines: SpecLine[];
  suppliers: ApprovedSupplier[];
  counterparties: Opt[];
  manufacturers: Opt[];
  materials: Opt[];
  onChange: (rows: ApprovedSupplier[]) => void;
  showTitle?: boolean;
};

const emptyRow = (): ApprovedSupplier => ({
  materialId: '',
  counterpartyId: '',
  manufacturerId: '',
});

export default function SpecSuppliersEditor({
  lines,
  suppliers,
  counterparties,
  manufacturers,
  materials,
  onChange,
  showTitle = true,
}: Props) {
  const componentIds = [...new Set(lines.map((l) => l.materialId).filter(Boolean))];
  const componentOptions = materials.filter((m) => componentIds.includes(m.id));

  const update = (idx: number, patch: Partial<ApprovedSupplier>) => {
    onChange(suppliers.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const remove = (idx: number) => onChange(suppliers.filter((_, i) => i !== idx));

  return (
    <div className="spec-lines">
      <div className="spec-lines-head">
        {showTitle ? <strong>Регистрация поставщиков</strong> : <span />}
        <button
          type="button"
          className="ghost"
          disabled={!componentOptions.length}
          onClick={() => onChange([...suppliers, emptyRow()])}
        >
          Добавить запись
        </button>
      </div>
      <p className="hint" style={{ margin: 0 }}>
        Для компонентов укажите одобренную тройку: материал, контрагент и производитель. При подборе партий
        зелёный бейдж — оба совпали с регистрацией, жёлтый — нет.
      </p>
      {!componentOptions.length && (
        <p className="muted">Сначала добавьте компоненты на вкладке «Рецептура».</p>
      )}
      <div className="table-wrap spec-lines-table">
        <table>
          <thead>
            <tr>
              <th>Компонент</th>
              <th>Контрагент</th>
              <th>Производитель</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {suppliers.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">
                  Нет записей. Добавьте тройки компонент — контрагент — производитель.
                </td>
              </tr>
            )}
            {suppliers.map((row, idx) => (
              <tr key={idx}>
                <td>
                  <SearchableSelect
                    required
                    value={row.materialId}
                    onChange={(v) => update(idx, { materialId: v })}
                    options={componentOptions.map((m) => ({ value: m.id, label: m.name }))}
                  />
                </td>
                <td>
                  <SearchableSelect
                    required
                    value={row.counterpartyId}
                    onChange={(v) => update(idx, { counterpartyId: v })}
                    options={counterparties.map((c) => ({ value: c.id, label: c.name }))}
                  />
                </td>
                <td>
                  <SearchableSelect
                    required
                    value={row.manufacturerId}
                    onChange={(v) => update(idx, { manufacturerId: v })}
                    options={manufacturers.map((m) => ({ value: m.id, label: m.name }))}
                  />
                </td>
                <td>
                  <div className="row-actions">
                    <IconButton icon="delete" label="Удалить" tone="danger" onClick={() => remove(idx)} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
