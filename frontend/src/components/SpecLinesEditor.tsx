import { SpecLine, LotCharacteristic } from '../types';
import { characteristicApplies, materialHasAssayDryApplication, RECALC_METHOD_LABEL, RECALC_METHOD_SHORT } from '../utils/lotCharacteristics';
import { newId } from '../utils/id';
import DecimalInput from './DecimalInput';
import IconButton from './IconButton';
import SearchableSelect from './SearchableSelect';

type MaterialOpt = { id: string; name: string; type?: string };

type Props = {
  lines: SpecLine[];
  materials: MaterialOpt[];
  characteristics?: LotCharacteristic[];
  onChange: (lines: SpecLine[]) => void;
  showTitle?: boolean;
};

const emptyLine = (): SpecLine => ({
  id: newId(),
  materialId: '',
  qtyPerUnit: 0,
  componentType: 'Вспомогательный',
  recalcMethod: 'none',
  recalcXLabel: null,
});

export default function SpecLinesEditor({
  lines,
  materials,
  characteristics = [],
  onChange,
  showTitle = true,
}: Props) {
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
        Норма расхода в кг на 1000 упаковок. При заказе на N уп. расход = норма × N / 1000. Метод
        «{RECALC_METHOD_SHORT}» ({RECALC_METHOD_LABEL}) доступен, только если материалу назначено
        применение количественного содержания и/или потери массы при высушивании. Эталон содержания
        % — из регистрации. Факт — документ «Управление характеристиками».
      </p>
      <div className="table-wrap spec-lines-table">
        <table>
          <thead>
            <tr>
              <th>Материал</th>
              <th>Тип компонента</th>
              <th>КГ на 1000 уп</th>
              <th>Пересчёт</th>
              <th>Эталон, %</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  Нет строк рецептуры. Добавьте компоненты.
                </td>
              </tr>
            )}
            {lines.map((line, idx) => {
              const mat = materials.find((m) => m.id === line.materialId);
              const applied = characteristics.filter((c) => characteristicApplies(c, mat));
              const canRecalc = materialHasAssayDryApplication(mat, characteristics);
              const recalcOptions = [{ value: 'none', label: 'Нет' }];
              if (canRecalc || line.recalcMethod === 'assay_and_dry') {
                recalcOptions.push({ value: 'assay_and_dry', label: RECALC_METHOD_SHORT });
              }
              return (
              <tr key={line.id || idx}>
                <td>
                  <SearchableSelect
                    required
                    value={line.materialId}
                    onChange={(v) => update(idx, { materialId: v })}
                    options={materials.map((m) => ({ value: m.id, label: m.name }))}
                  />
                  {applied.length ? (
                    <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                      ведутся: {applied.map((c) => c.name).join(', ')}
                    </div>
                  ) : null}
                </td>
                <td>
                  <SearchableSelect
                    value={line.componentType || ''}
                    onChange={(v) => update(idx, { componentType: v })}
                    options={[
                      { value: 'Активный', label: 'Активный' },
                      { value: 'Вспомогательный', label: 'Вспомогательный' },
                    ]}
                  />
                </td>
                <td>
                  <DecimalInput
                    min={0}
                    value={line.qtyPerUnit ?? 0}
                    onValueChange={(value) => update(idx, { qtyPerUnit: value ?? 0 })}
                  />
                </td>
                <td className="spec-recalc-cell">
                  <SearchableSelect
                    className="spec-recalc-select"
                    value={line.recalcMethod || 'none'}
                    allowEmpty={false}
                    onChange={(v) =>
                      update(idx, {
                        recalcMethod: v === 'assay_and_dry' && canRecalc ? v : 'none',
                        recalcXLabel:
                          v === 'assay_and_dry' && canRecalc ? line.recalcXLabel || 100 : null,
                      })
                    }
                    options={recalcOptions}
                  />
                  {line.recalcMethod === 'assay_and_dry' && !canRecalc ? (
                    <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                      Нет применения количественного содержания / потери массы при высушивании —
                      метод не действует. Назначьте применение или выберите «Нет».
                    </div>
                  ) : null}
                </td>
                <td className="spec-xlabel-cell">
                  <DecimalInput
                    min={0}
                    allowEmpty
                    disabled={(line.recalcMethod || 'none') !== 'assay_and_dry' || !canRecalc}
                    value={line.recalcXLabel ?? null}
                    onValueChange={(value) => update(idx, { recalcXLabel: value })}
                  />
                </td>
                <td>
                  <div className="row-actions">
                    <IconButton icon="delete" label="Удалить" tone="danger" onClick={() => remove(idx)} />
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
