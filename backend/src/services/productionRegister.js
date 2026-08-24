import crypto from 'crypto';
import * as store from '../store.js';

function cryptoRandom() {
  return crypto.randomUUID();
}

function rowForOrder(productionOrderId) {
  return store.readAll('production_register').find((r) => r.productionOrderId === productionOrderId) || null;
}

/** Снимок аналитики производства при завершении заказа (одна запись на заказ). */
export function upsertProductionRegister({
  order,
  gpLot,
  outputQty,
  actorId,
  resDoc,
  priDoc,
  prrDoc,
  factLines,
}) {
  const series = store.getById('series', order.seriesId);
  const components = (factLines || []).map((l) => {
    const lot = store.getById('lots', l.lotId);
    return {
      materialId: l.materialId,
      lotId: l.lotId || null,
      quantity: Number(l.quantity) || 0,
      counterpartyId: lot?.counterpartyId || null,
      manufacturerId: lot?.manufacturerId || null,
    };
  });

  const patch = {
    productionOrderId: order.id,
    seriesId: order.seriesId || null,
    seriesNumber: series?.number || null,
    specificationId: order.specificationId || null,
    workCenterId: order.workCenterId || null,
    productMaterialId: order.materialId,
    gpLotId: gpLot?.id || null,
    gpLotNumber: gpLot?.number || null,
    quantity: Number(outputQty) || 0,
    productionDate: gpLot?.productionDate || new Date().toISOString().slice(0, 10),
    completedAt: new Date().toISOString(),
    completedByUserId: actorId || null,
    reservationDocumentId: resDoc?.id || null,
    productionIssueDocumentId: priDoc?.id || null,
    productionReceiptDocumentId: prrDoc?.id || null,
    documentNumber: prrDoc?.number || '',
    components,
  };

  const existing = rowForOrder(order.id);
  if (existing) {
    return store.update('production_register', existing.id, patch);
  }
  return store.create('production_register', { id: cryptoRandom(), ...patch });
}

export function listProductionRegister() {
  return store.readAll('production_register');
}
