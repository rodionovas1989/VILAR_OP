import { StockDocument } from '../types.documents';

export function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function timeFromIso(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function dateFromIso(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function displayTimeFromIso(iso?: string | null): string {
  const t = timeFromIso(iso);
  return t || '—';
}

export function displayDocTime(doc: StockDocument): string {
  if (doc.time) return doc.time;
  if (doc.postedAt) return timeFromIso(doc.postedAt);
  return timeFromIso(doc.createdAt) || '—';
}
