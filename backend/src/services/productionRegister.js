import crypto from 'crypto';
import * as store from '../store.js';

function cryptoRandom() {
  return crypto.randomUUID();
}

/**
 * Движение аналитики производства (параллельно material_movements / stock).
 * Пишется при проведении PRI (расход) и PRR (выпуск).
 */
export function appendProductionMovement(doc, line, qtyDelta) {
  const qty = Number(qtyDelta) || 0;
  if (Math.abs(qty) < 1e-12) return null;

  const order = doc.productionOrderId
    ? store.getById('production_orders', doc.productionOrderId)
    : null;
  const seriesId = doc.seriesId || order?.seriesId || null;
  const series = seriesId ? store.getById('series', seriesId) : null;
  const lot = line.lotId ? store.getById('lots', line.lotId) : null;

  return store.create('production_register', {
    id: cryptoRandom(),
    at: new Date().toISOString(),
    type: qty >= 0 ? 'receipt' : 'issue',
    materialId: line.materialId,
    lotId: line.lotId || null,
    quantity: qty,
    productionOrderId: doc.productionOrderId || null,
    seriesId,
    seriesNumber: series?.number || null,
    specificationId: order?.specificationId || null,
    workCenterId: order?.workCenterId || null,
    documentId: doc.id,
    documentNumber: doc.number || '',
    documentType: doc.type,
    documentStatus: 'posted',
    counterpartyId: lot?.counterpartyId || null,
    manufacturerId: lot?.manufacturerId || null,
    userId: doc.postedByUserId || doc.createdByUserId || null,
  });
}

/** Пометить движения регистра отменёнными при отмене/перепроведении документа. */
export function cancelProductionMovementsForDocument(documentId) {
  const rows = store
    .readAll('production_register')
    .filter((r) => r.documentId === documentId && r.documentStatus !== 'cancelled');
  for (const row of rows) {
    store.update('production_register', row.id, { documentStatus: 'cancelled' });
  }
  return rows.length;
}

export function listProductionRegister() {
  return store.readAll('production_register');
}

/** Активные (не отменённые) движения по заказу. */
export function activeMovementsForOrder(productionOrderId) {
  return store
    .readAll('production_register')
    .filter(
      (r) =>
        r.productionOrderId === productionOrderId && r.documentStatus !== 'cancelled'
    );
}
