import { SubstitutionLine } from '../types';
import DecimalInput from './DecimalInput';
import IconButton from './IconButton';
import SearchableSelect from './SearchableSelect';

type MaterialOpt = { id: string; name: string };

type Props = {
  editing: Record<string, unknown>;
  setEditing: (row: Record<string, unknown>) => void;
  materials: MaterialOpt[];
  specifications: { id: string; name: string }[];
};

export default function SubstitutionForm({ editing, setEditing, materials, specifications }: Props) {
  const lines = (editing.lines as SubstitutionLine[]) || [];
  const baseMaterialId = String(editing.baseMaterialId || '');

  const setField = (key: string, value: unknown) => {
    setEditing({ ...editing, [key]: value });
  };

  const updateLine = (idx: number, patch: Partial<SubstitutionLine>) => {
    setField(
      'lines',
      lines.map((l, i) => (i === idx ? { ...l, ...patch } : l))
    );
  };

  const analogOptions = materials.filter((m) => m.id !== baseMaterialId);

  return (
    <div className="spec-detail-tabs">
      <div className="form-grid spec-general-tab">
        <label>
          <span>Название</span>
          <input value={String(editing.name ?? '')} onChange={(e) => setField('name', e.target.value)} />
        </label>
        <label>
          <span>Базовый материал</span>
          <SearchableSelect
            required
            value={baseMaterialId}
            onChange={(v) => setField('baseMaterialId', v)}
            options={materials.map((m) => ({ value: m.id, label: m.name }))}
          />
        </label>
        <label>
          <span>Спецификация (пусто = все)</span>
          <SearchableSelect
            value={String(editing.specificationId || '')}
            onChange={(v) => setField('specificationId', v || null)}
            emptyLabel="Все спецификации"
            options={specifications.map((s) => ({ value: s.id, label: s.name }))}
          />
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={editing.bidirectional !== false}
            onChange={(e) => setField('bidirectional', e.target.checked)}
          />
          <span>Двусторонняя замена (аналог ↔ базовый)</span>
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={editing.active !== false}
            onChange={(e) => setField('active', e.target.checked)}
          />
          <span>Действует</span>
        </label>
      </div>
      <p className="hint">
        В шапке — материал из спецификации. В таблице — чем его можно заменить (пока 1:1, без пересчёта
        коэффициента). Привязка к спецификации необязательна.
      </p>
      <div className="spec-lines">
        <div className="spec-lines-head">
          <strong>Аналоги</strong>
          <button
            type="button"
            className="ghost"
            onClick={() => setField('lines', [...lines, { materialId: '', factor: 1, priority: lines.length + 1 }])}
          >
            Добавить строку
          </button>
        </div>
        <div className="table-wrap spec-lines-table">
          <table>
            <thead>
              <tr>
                <th>Материал-аналог</th>
                <th>Приоритет</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {!lines.length && (
                <tr>
                  <td colSpan={3} className="muted">
                    Нет аналогов. Добавьте материалы, которыми можно заменить базовый.
                  </td>
                </tr>
              )}
              {lines.map((line, idx) => (
                <tr key={idx}>
                  <td>
                    <SearchableSelect
                      required
                      value={line.materialId}
                      onChange={(v) => updateLine(idx, { materialId: v })}
                      options={analogOptions.map((m) => ({ value: m.id, label: m.name }))}
                    />
                  </td>
                  <td>
                    <DecimalInput
                      min={1}
                      value={line.priority ?? idx + 1}
                      onValueChange={(value) =>
                        updateLine(idx, { priority: Math.max(1, Math.round(value ?? idx + 1)) })
                      }
                    />
                  </td>
                  <td>
                    <div className="row-actions">
                      <IconButton
                        icon="delete"
                        label="Удалить"
                        tone="danger"
                        onClick={() => setField('lines', lines.filter((_, i) => i !== idx))}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}