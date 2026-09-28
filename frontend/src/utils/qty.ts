/** Согласовано с backend roundQty (documents.js): 6 знаков после запятой. */
export function roundQty(n: number): number {
  return Number(Number(n || 0).toFixed(6));
}

const DEFAULT_DISPLAY_DECIMALS = 3;

/** Нормализация масштаба отображения из модели учёта (0…6). */
export function clampQtyDisplayDecimals(raw: number | null | undefined): number {
  if (raw == null || !Number.isFinite(Number(raw))) return DEFAULT_DISPLAY_DECIMALS;
  return Math.min(6, Math.max(0, Math.floor(Number(raw))));
}

/**
 * Показ количества. `decimals` — из модели учёта; без аргумента — как roundQty (6).
 * На хранение не влияет.
 */
export function formatQty(n: number, decimals?: number): string {
  const d = decimals == null ? 6 : clampQtyDisplayDecimals(decimals);
  const v = Number(Number(n || 0).toFixed(d));
  if (Number.isInteger(v)) return String(v);
  return String(v);
}

export function formatQtyDelta(delta: number, decimals?: number): string {
  const d = decimals == null ? 6 : clampQtyDisplayDecimals(decimals);
  const v = Number(Number(delta || 0).toFixed(d));
  if (v > 0) return `+${formatQty(v, d)}`;
  return formatQty(v, d);
}

export function qtyDisplayDecimalsForMaterial(
  materialId: string | undefined | null,
  materials: { id: string; accountingModelId?: string }[],
  models: { id: string; qtyDisplayDecimals?: number }[]
): number {
  if (!materialId) return DEFAULT_DISPLAY_DECIMALS;
  const mat = materials.find((m) => m.id === materialId);
  const model = models.find((m) => m.id === mat?.accountingModelId);
  return clampQtyDisplayDecimals(model?.qtyDisplayDecimals);
}
