import * as store from '../store.js';

export function warehouseByType(type) {
  return store.readAll('warehouses').find((w) => w.type === type) || null;
}

export function stockRowForLot(lotId, warehouseId) {
  const all = store.readAll('stock').filter((s) => s.lotId === lotId);
  if (warehouseId) {
    return all.find((s) => s.warehouseId === warehouseId) || null;
  }
  return all[0] || null;
}

/**
 * Свободный остаток = запас − активные резервы документов (RES posted).
 * excludeProductionOrderId — не учитывать резерв этого заказа (перепланирование).
 */
export function freeQtyByLot(lotId, { excludeProductionOrderId, warehouseId } = {}) {
  const wh = warehouseId || warehouseByType('компоненты')?.id;
  const stockRow = stockRowForLot(lotId, wh);
  if (!stockRow) return 0;
  const reserved = store
    .readAll('active_reservations')
    .filter((r) => r.lotId === lotId)
    .filter((r) => !excludeProductionOrderId || r.productionOrderId !== excludeProductionOrderId)
    .filter((r) => !wh || !r.warehouseId || r.warehouseId === wh)
    .reduce((sum, r) => sum + Number(r.quantity || 0), 0);
  return Number((Number(stockRow.quantity) - reserved).toFixed(6));
}
