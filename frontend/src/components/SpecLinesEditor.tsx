import { SpecLine } from '../types';
import IconButton from './IconButton';

type MaterialOpt = { id: string; name: string; type?: string };

type Props = {
  lines: SpecLine[];
  materials: MaterialOpt[];
  onChange: (lines: SpecLine[]) => void;
  showTitle?: boolean;
};

const emptyLine = (): SpecLine => ({
  materialId: '',
  qtyPerUnit: 0,
  qtyMgPerTablet: undefined,
  componentType: 'Вспомогательный',
});

export default function SpecLinesEditor({ lines, materials, onChange, showTitle = true }: Props) {
  const update = (idx: number, patch: Partial<SpecLine>) => {
    onChange(lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const remove = (idx: number) => onChange(lines.filter((_, i) => i !== idx));

  return (
    <div className="spec-lines">
      <div className="spec-lines-head">
        {showTitle && <strong>Рецептура</strong>}
        {!showTitle && <span />}
        <button type="button" className="ghost" onClick={() => onChange([...lines, emptyLine()])}>
          Добавить строку
        </button>
      </div>
      <p className="hint" style={{ margin: 0 }}>
        Норма расхода в кг на 1000 упаковок. При заказе на N уп. расход = норма × N / 1000.
      </p>
      <div className="table-wrap spec-lines-table">
        <table>
          <thead>
            <tr>
              <th>Материал</th>
              <th>Тип компонента</th>
              <th>КГ на 1000 уп</th>
              <th>мг/табл.</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  Нет строк рецептуры. Добавьте компоненты.
                </td>
              </tr>
            )}
            {lines.map((line, idx) => (
              <tr key={idx}>
                <td>
                  <select
                    required
                    value={line.materialId}
                    onChange={(e) => update(idx, { materialId: e.target.value })}
                  >
                    <option value="">—</option>
                    {materials.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <select
                    value={line.componentType || ''}
                    onChange={(e) => update(idx, { componentType: e.target.value })}
                  >
                    <option value="Активный">Активный</option>
                    <option value="Вспомогательный">Вспомогательный</option>
                    <option value="">—</option>
                  </select>
                </td>
                <td>
                  <input
                    type="number"
                    step="any"
                    min={0}
                    value={line.qtyPerUnit ?? 0}
                    onChange={(e) => update(idx, { qtyPerUnit: Number(e.target.value) })}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="any"
                    min={0}
                    value={line.qtyMgPerTablet ?? ''}
                    onChange={(e) =>
                      update(idx, {
                        qtyMgPerTablet: e.target.value === '' ? undefined : Number(e.target.value),
                      })
                    }
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
