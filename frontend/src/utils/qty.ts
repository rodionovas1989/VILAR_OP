/** Согласовано с backend roundQty (documents.js): 6 знаков после запятой. */
export function roundQty(n: number): number {
  return Number(Number(n || 0).toFixed(6));
}

export function formatQty(n: number): string {
  const v = roundQty(n);
  if (Number.isInteger(v)) return String(v);
  return String(v);
}

export function formatQtyDelta(delta: number): string {
  const v = roundQty(delta);
  if (v > 0) return `+${formatQty(v)}`;
  return formatQty(v);
}
