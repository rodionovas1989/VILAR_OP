import { ApprovedSupplier, SpecLine, Substitution } from '../types';
import IconButton from './IconButton';
import SearchableSelect from './SearchableSelect';
import { isSpecAnalogueMaterial, substitutesFor } from '../utils/substitutions';

type Opt = { id: string; name: string };

type MaterialOption = {
  value: string;
  label: string;
  analogue: boolean;
};

type Props = {
  lines: SpecLine[];
  suppliers: ApprovedSupplier[];
  counterparties: Opt[];
  manufacturers: Opt[];
  materials: Opt[];
  substitutions?: Substitution[];
  specificationId?: string | null;
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
  substitutions = [],
  specificationId = null,
  onChange,
  showTitle = true,
}: Props) {
  const componentIds = [...new Set(lines.map((l) => l.materialId).filter(Boolean))];
  const nameOf = (id: string) => materials.find((m) => m.id === id)?.name || id;

  const materialOptions: MaterialOption[] = [];
  const seen = new Set<string>();
  const pushOpt = (id: string, analogue: boolean, baseName?: string) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    const name = nameOf(id);
    materialOptions.push({
      value: id,
      label: analogue ? `${name} (аналог${baseName ? ` · вместо ${baseName}` : ''})` : name,
      analogue,
    });
  };

  for (const baseId of componentIds) {
    pushOpt(baseId, false);
    for (const sub of substitutesFor(substitutions, baseId, specificationId)) {
      pushOpt(sub.materialId, true, nameOf(baseId));
    }
  }
  for (const row of suppliers) {
    if (row.materialId && !seen.has(row.materialId)) {
      const analogue = isSpecAnalogueMaterial(
        substitutions,
        row.materialId,
        componentIds,
        specificationId
      );
      pushOpt(row.materialId, analogue);
    }
  }

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
          disabled={!materialOptions.length}
          onClick={() => onChange([...suppliers, emptyRow()])}
        >
          Добавить запись
        </button>
      </div>
      <p className="hint" style={{ margin: 0 }}>
        Одобренная тройка: материал (компонент рецептуры или его аналог), контрагент и производитель. Аналог
        в списке помечен и подсвечивается в строке. При подборе партий зелёный бейдж — совпадение с
        регистрацией, жёлтый — нет.
      </p>
      {!componentIds.length && (
        <p className="muted">Сначала добавьте компоненты на вкладке «Рецептура».</p>
      )}
      <div className="table-wrap spec-lines-table">
        <table>
          <thead>
            <tr>
              <th>Компонент / аналог</th>
              <th>Контрагент</th>
              <th>Производитель</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {suppliers.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">
                  Нет записей. Добавьте тройки материал — контрагент — производитель.
                </td>
              </tr>
            )}
            {suppliers.map((row, idx) => {
              const analogue = isSpecAnalogueMaterial(
                substitutions,
                row.materialId,
                componentIds,
                specificationId
              );
              return (
                <tr key={idx} className={analogue ? 'spec-supplier-analogue-row' : undefined}>
                  <td>
                    <div className={`spec-supplier-material${analogue ? ' is-analogue' : ''}`}>
                      <SearchableSelect
                        required
                        value={row.materialId}
                        onChange={(v) => update(idx, { materialId: v })}
                        options={materialOptions.map((m) => ({ value: m.value, label: m.label }))}
                      />
                      {analogue ? <span className="spec-analogue-badge">Аналог</span> : null}
                    </div>
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
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
