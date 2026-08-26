/** Ключ выбора партии×склад (одна партия может быть на нескольких складах). */
export function lotWhKey(lotId: string, warehouseId?: string | null) {
  return warehouseId ? `${lotId}::${warehouseId}` : lotId;
}

export function parseLotWhKey(value: string): { lotId: string; warehouseId?: string } {
  const i = value.indexOf('::');
  if (i < 0) return { lotId: value };
  return { lotId: value.slice(0, i), warehouseId: value.slice(i + 2) };
}

/** Короткий ярлык склада для таблиц и опций (полный name — в title). */
export function shortWarehouseLabel(type?: string | null, name?: string | null): string {
  if (type === 'компоненты') return 'комп.';
  if (type === 'ГП') return 'ГП';
  if (type) return type;
  if (name) {
    const t = name.trim();
    return t.length > 18 ? `${t.slice(0, 16)}…` : t;
  }
  return '';
}

type LotLabelSource = {
  number: string;
  freeQty?: number | null;
  warehouseId?: string | null;
  warehouseName?: string | null;
  warehouseType?: string | null;
  qualityAllowed?: boolean;
  qualityPermission?: string | null;
  qualityName?: string | null;
};

function qualityPrefix(o: LotLabelSource): string {
  if (o.qualityAllowed === false) return '⛔ ';
  if (o.qualityPermission === 'conditional') return '⚠ ';
  return '';
}

/**
 * Подпись опции в подборе: только номер (+ иконка качества).
 * Склад и свободно — в соседних колонках; не дублировать в label.
 */
export function formatLotNumberLabel(o: LotLabelSource, _disambiguateWarehouse = false): string {
  return `${qualityPrefix(o)}${o.number}`;
}

/**
 * Короткая подпись опции партии (стол факта и т.п.).
 * Склад — только коротким типом; полное имя склада в отдельной колонке.
 */
export function formatLotWhOptionLabel(
  o: LotLabelSource,
  opts?: { includeWarehouse?: boolean; includeQualityName?: boolean; includeFreeQty?: boolean }
): string {
  const wh =
    opts?.includeWarehouse !== false && (o.warehouseType || o.warehouseName)
      ? ` · ${shortWarehouseLabel(o.warehouseType, o.warehouseName)}`
      : '';
  const free =
    opts?.includeFreeQty !== false && o.freeQty != null && Number.isFinite(Number(o.freeQty))
      ? ` · своб. ${o.freeQty}`
      : '';
  const qName =
    opts?.includeQualityName && o.qualityName && o.qualityAllowed !== false
      ? ` · ${o.qualityName}`
      : '';
  return `${qualityPrefix(o)}${o.number}${wh}${free}${qName}`;
}
