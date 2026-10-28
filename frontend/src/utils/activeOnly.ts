/** Soft-flag «Активен» у справочников (users, qualities, CP/MFR, …). */
export function isActive(row: { active?: boolean | string } | null | undefined): boolean {
  return row?.active !== false && row?.active !== 'false';
}

export function activeOnly<T extends { active?: boolean | string }>(rows: T[]): T[] {
  return rows.filter(isActive);
}

/** Активные + текущий id (архивная ссылка остаётся видимой при правке). */
export function activeOrSelected<T extends { id: string; active?: boolean | string }>(
  rows: T[],
  selectedId?: string | null
): T[] {
  const sel = selectedId ? String(selectedId) : '';
  return rows.filter((r) => isActive(r) || (sel && r.id === sel));
}
