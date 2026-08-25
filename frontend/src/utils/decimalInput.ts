/** Разрешённый черновик числа: цифры и один разделитель `.` или `,`. */
export function isAllowedDecimalDraft(raw: string): boolean {
  if (raw === '') return true;
  return /^\d*[.,]?\d*$/.test(raw);
}

/** Парсит черновик; пустой / только разделитель → null. */
export function parseDecimalDraft(raw: string): number | null {
  const normalized = String(raw).trim().replace(',', '.');
  if (!normalized || normalized === '.') return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export function formatDecimalDisplay(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '';
  return String(value).replace('.', ',');
}
