import {
  ReleasedSeriesComponent,
  ReleasedSeriesProductComponent,
  ReleasedSeriesProductSeries,
  ReleasedSeriesRow,
} from '../types';

export type SeriesLink = { kind: 'series'; orderId: string };
export type ComponentLink = { kind: 'component'; key: string };
export type ReportLink = SeriesLink | ComponentLink;

export type LinkedSeriesRow = ReleasedSeriesProductSeries & {
  componentQty: number | null;
};

export function componentKey(c: { materialId: string; lotId?: string; lotNumber?: string }) {
  return `${c.materialId}::${c.lotId || c.lotNumber || ''}`;
}

function byRu(a: string, b: string) {
  return String(a).localeCompare(String(b), 'ru', { numeric: true });
}

export function aggregateComponents(
  lines: ReleasedSeriesComponent[]
): ReleasedSeriesProductComponent[] {
  const map = new Map<string, ReleasedSeriesProductComponent>();
  for (const c of lines) {
    const key = componentKey(c);
    const qty = Number(c.quantity) || 0;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, {
        materialId: c.materialId,
        materialName: c.materialName,
        unit: c.unit || '',
        lotId: c.lotId || '',
        lotNumber: c.lotNumber || '—',
        counterpartyId: c.counterpartyId || '',
        counterpartyName: c.counterpartyName || '—',
        manufacturerId: c.manufacturerId || '',
        manufacturerName: c.manufacturerName || '—',
        quantity: qty,
      });
    } else {
      prev.quantity = Number((prev.quantity + qty).toFixed(6));
    }
  }
  return [...map.values()].sort(
    (a, b) => byRu(a.materialName, b.materialName) || byRu(a.lotNumber, b.lotNumber)
  );
}

export function rowsOfProduct(rows: ReleasedSeriesRow[], productId: string, productName: string) {
  return rows.filter(
    (row) => (productId && row.productId === productId) || (!productId && row.productName === productName)
  );
}

export function componentsOfSeries(rows: ReleasedSeriesRow[], orderId: string) {
  const row = rows.find((item) => item.orderId === orderId || item.id === orderId);
  return aggregateComponents(row?.components || []);
}

export function seriesUsingComponent(
  rows: ReleasedSeriesRow[],
  productId: string,
  productName: string,
  key: string
): LinkedSeriesRow[] {
  const hits: LinkedSeriesRow[] = [];
  for (const row of rowsOfProduct(rows, productId, productName)) {
    let componentQty = 0;
    for (const c of row.components || []) {
      if (componentKey(c) === key) componentQty += Number(c.quantity) || 0;
    }
    if (!(componentQty > 0)) continue;
    hits.push({
      orderId: row.orderId || row.id,
      seriesId: row.seriesId,
      seriesNumber: row.seriesNumber,
      lotId: row.lotId,
      lotNumber: row.lotNumber,
      productionDate: row.productionDate,
      quantity: row.quantity,
      componentQty: Number(componentQty.toFixed(6)),
    });
  }
  return hits.sort((a, b) => byRu(a.seriesNumber, b.seriesNumber));
}
