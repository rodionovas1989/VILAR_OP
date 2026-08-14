import * as store from '../store.js';
import * as documents from './documents.js';

const DONE_STATUS = 'завершен';

function indexById(rows) {
  const map = {};
  for (const row of rows) map[row.id] = row;
  return map;
}

/** Отчёт: выпущенные серии продукции (завершённые заказы). */
export function releasedSeriesReport() {
  const orders = store.readAll('production_orders').filter((o) => o.status === DONE_STATUS);
  const materials = indexById(store.readAll('materials'));
  const seriesMap = indexById(store.readAll('series'));
  const lotsList = store.readAll('lots');
  const lots = indexById(lotsList);

  const rows = [];
  for (const order of orders) {
    const series = seriesMap[order.seriesId];
    const prrDocs = documents
      .listDocuments('production_receipt', { productionOrderId: order.id })
      .filter((d) => d.status === 'posted');
    const prr = prrDocs[0] || null;
    const gpLine = prr?.lines?.[0] || null;
    const gpLot =
      (gpLine?.lotId && lots[gpLine.lotId]) ||
      lotsList.find((l) => l.number === `ГП-${series?.number || ''}`) ||
      null;

    const quantity =
      order.actualQuantity != null && Number(order.actualQuantity) > 0
        ? Number(order.actualQuantity)
        : gpLine
          ? Number(gpLine.quantity)
          : Number(order.quantity) || 0;

    const productionDate =
      gpLot?.productionDate || prr?.date || String(order.endAt || '').slice(0, 10) || '—';

    const factLines =
      Array.isArray(order.actualLines) && order.actualLines.length > 0
        ? order.actualLines
        : order.lines || [];

    rows.push({
      id: order.id,
      orderId: order.id,
      productId: order.materialId,
      productName: materials[order.materialId]?.name || order.materialId,
      seriesId: order.seriesId || '',
      seriesNumber: series?.number || order.seriesId || '—',
      lotId: gpLot?.id || gpLine?.lotId || '',
      lotNumber: gpLot?.number || gpLine?.lotId || '—',
      productionDate,
      quantity,
      documentNumber: prr?.number || '',
      components: factLines.map((l) => {
        const mat = materials[l.materialId];
        const lot = lots[l.lotId];
        return {
          materialId: l.materialId,
          materialName: mat?.name || l.materialId,
          unit: mat?.unit || '',
          lotId: l.lotId || '',
          lotNumber: lot?.number || l.lotId || '—',
          quantity: Number(l.quantity) || 0,
        };
      }),
    });
  }

  rows.sort(
    (a, b) =>
      String(b.productionDate).localeCompare(String(a.productionDate)) ||
      String(a.seriesNumber).localeCompare(String(b.seriesNumber), 'ru', { numeric: true })
  );
  return rows;
}

export function filterReleasedSeries(rows, ids) {
  if (!Array.isArray(ids) || !ids.length) return rows;
  const set = new Set(ids.map(String));
  return rows.filter((r) => set.has(String(r.id)));
}

function roundQty(n) {
  return Number(Number(n || 0).toFixed(6));
}

/** Отчёт запасов: плоские строки партия×склад (иерархия собирается на клиенте и в Excel). */
export function stockReport() {
  const stock = store.readAll('stock');
  const materials = indexById(store.readAll('materials'));
  const lots = indexById(store.readAll('lots'));
  const warehouses = indexById(store.readAll('warehouses'));
  const counterparties = indexById(store.readAll('counterparties'));
  const reservations = store.readAll('active_reservations');

  const reservedByKey = {};
  for (const r of reservations) {
    const key = `${r.warehouseId || ''}|${r.lotId}`;
    reservedByKey[key] = roundQty((reservedByKey[key] || 0) + Number(r.quantity || 0));
  }

  const rows = [];
  for (const s of stock) {
    const qty = roundQty(s.quantity);
    const lot = lots[s.lotId];
    const materialId = s.materialId || lot?.materialId || '';
    const material = materials[materialId];
    const warehouseId = s.warehouseId || '';
    const warehouse = warehouses[warehouseId];
    const cp = lot?.counterpartyId ? counterparties[lot.counterpartyId] : null;
    const reserved = reservedByKey[`${warehouseId}|${s.lotId}`] || 0;
    const free = roundQty(qty - reserved);
    if (qty === 0 && reserved === 0) continue;

    rows.push({
      id: s.id,
      warehouseId: warehouseId || 'none',
      warehouseName: warehouse?.name || 'Без склада',
      warehouseType: warehouse?.type || '—',
      materialId: materialId || 'none',
      materialName: material?.name || materialId || '—',
      materialType: material?.type || '—',
      unit: material?.unit || '',
      lotId: s.lotId || '',
      lotNumber: lot?.number || s.lotId || '—',
      counterpartyId: lot?.counterpartyId || '',
      counterpartyName: cp?.name || '—',
      productionDate: lot?.productionDate || '—',
      expiryDate: lot?.expiryDate || '—',
      quantity: qty,
      reserved,
      free,
    });
  }

  rows.sort(
    (a, b) =>
      a.warehouseName.localeCompare(b.warehouseName, 'ru') ||
      a.materialName.localeCompare(b.materialName, 'ru') ||
      String(a.expiryDate).localeCompare(String(b.expiryDate)) ||
      a.lotNumber.localeCompare(b.lotNumber, 'ru', { numeric: true })
  );
  return rows;
}

export function filterStockReport(rows, ids) {
  if (!Array.isArray(ids) || !ids.length) return rows;
  const set = new Set(ids.map(String));
  return rows.filter((r) => set.has(String(r.id)));
}

export function groupStockRows(rows) {
  const warehouses = [];
  const whMap = new Map();
  for (const row of rows) {
    let wh = whMap.get(row.warehouseId);
    if (!wh) {
      wh = {
        id: row.warehouseId,
        name: row.warehouseName,
        type: row.warehouseType,
        quantity: 0,
        reserved: 0,
        free: 0,
        materials: [],
      };
      whMap.set(row.warehouseId, wh);
      warehouses.push(wh);
    }
    let mat = wh.materials.find((m) => m.id === row.materialId);
    if (!mat) {
      mat = {
        id: row.materialId,
        name: row.materialName,
        type: row.materialType,
        unit: row.unit,
        quantity: 0,
        reserved: 0,
        free: 0,
        lots: [],
      };
      wh.materials.push(mat);
    }
    mat.lots.push(row);
    mat.quantity = roundQty(mat.quantity + row.quantity);
    mat.reserved = roundQty(mat.reserved + row.reserved);
    mat.free = roundQty(mat.free + row.free);
    wh.quantity = roundQty(wh.quantity + row.quantity);
    wh.reserved = roundQty(wh.reserved + row.reserved);
    wh.free = roundQty(wh.free + row.free);
  }
  return warehouses;
}
