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
 * warehouseId — обязателен для корректного учёта по складу; если не передан —
 * используется склад типа «компоненты» (обратная совместимость).
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

/** Склады, где у партии есть положительный свободный остаток. */
export function warehousesWithFreeQty(lotId, { excludeProductionOrderId } = {}) {
  const rows = store.readAll('stock').filter((s) => s.lotId === lotId && Number(s.quantity) > 0);
  const out = [];
  for (const s of rows) {
    const free = freeQtyByLot(lotId, {
      warehouseId: s.warehouseId,
      excludeProductionOrderId,
    });
    if (free > 0) {
      const wh = store.getById('warehouses', s.warehouseId);
      out.push({
        warehouseId: s.warehouseId,
        warehouseName: wh?.name || s.warehouseId,
        warehouseType: wh?.type || '',
        freeQty: free,
      });
    }
  }
  return out;
}

/** Предпочесть склад «компоненты», иначе первый с достаточным остатком. */
export function preferWarehouseForNeed(lotId, needQty, { excludeProductionOrderId } = {}) {
  const avail = warehousesWithFreeQty(lotId, { excludeProductionOrderId });
  const need = Number(needQty) || 0;
  const enough = avail.filter((a) => a.freeQty >= need);
  const pool = enough.length ? enough : avail;
  if (!pool.length) return null;
  const comp = warehouseByType('компоненты')?.id;
  if (comp) {
    const hit = pool.find((a) => a.warehouseId === comp);
    if (hit) return hit;
  }
  return pool[0];
}
