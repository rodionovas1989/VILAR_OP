import { ApprovedSupplier, SpecLine } from '../types';
import IconButton from './IconButton';

type Opt = { id: string; name: string };

type Props = {
  lines: SpecLine[];
  suppliers: ApprovedSupplier[];
  counterparties: Opt[];
  materials: Opt[];
  onChange: (rows: ApprovedSupplier[]) => void;
};

const emptyRow = (): ApprovedSupplier => ({ materialId: '', counterpartyId: '' });

export default function SpecSuppliersEditor({
  lines,
  suppliers,
  counterparties,
  materials,
  onChange,
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
        <strong>Регистрация поставщиков</strong>
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
        Для компонентов спецификации укажите одобренных для производства поставщиков (контрагентов). При подборе
        партий неодобренный контрагент выделяется жёлтым, одобренный — зелёным.
      </p>
      {!componentOptions.length && (
        <p className="muted">Сначала добавьте компоненты на вкладке «Рецептура».</p>
      )}
      <div className="table-wrap spec-lines-table">
        <table>
          <thead>
            <tr>
              <th>Компонент</th>
              <th>Одобренный поставщик</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {suppliers.length === 0 && (
              <tr>
                <td colSpan={3} className="muted">
                  Нет записей. Добавьте пары компонент — поставщик.
                </td>
              </tr>
            )}
            {suppliers.map((row, idx) => (
              <tr key={idx}>
                <td>
                  <select
                    required
                    value={row.materialId}
                    onChange={(e) => update(idx, { materialId: e.target.value })}
                  >
                    <option value="">—</option>
                    {componentOptions.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <select
                    required
                    value={row.counterpartyId}
                    onChange={(e) => update(idx, { counterpartyId: e.target.value })}
                  >
                    <option value="">—</option>
                    {counterparties.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
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
