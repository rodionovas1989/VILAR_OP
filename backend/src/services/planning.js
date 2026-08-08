import * as store from '../store.js';

/** Свободный остаток партии = запас − активные резервы */
export function freeQtyByLot(lotId, excludeReservationIds = []) {
  const stockRow = store.readAll('stock').find((s) => s.lotId === lotId);
  if (!stockRow) return 0;
  const reserved = store
    .readAll('reservations')
    .filter((r) => r.lotId === lotId && !excludeReservationIds.includes(r.id))
    .reduce((sum, r) => sum + Number(r.quantity || 0), 0);
  return Number((stockRow.quantity - reserved).toFixed(6));
}

export function availableLotsForMaterial(materialId, algorithm = 'FEFO') {
  const lots = store
    .readAll('lots')
    .filter((l) => l.materialId === materialId)
    .map((l) => ({
      ...l,
      freeQty: freeQtyByLot(l.id),
      counterparty: store.getById('counterparties', l.counterpartyId),
    }))
    .filter((l) => l.freeQty > 0 && new Date(l.expiryDate) >= new Date());

  lots.sort((a, b) => {
    if (algorithm === 'FIFO') {
      return new Date(a.productionDate) - new Date(b.productionDate);
    }
    // FEFO
    return new Date(a.expiryDate) - new Date(b.expiryDate);
  });
  return lots;
}

/**
 * GMP: одна партия на один компонент в рамках серии/заказа.
 * Не дробим потребность по нескольким партиям.
 */
export function suggestPicksForOrder(orderId, algorithm = 'FEFO') {
  const order = store.getById('production_orders', orderId);
  if (!order) throw new Error('Заказ не найден');
  const spec = store.getById('specifications', order.specificationId);
  if (!spec) throw new Error('Спецификация не найдена');

  const picks = [];
  const warnings = [];

  for (const line of spec.lines) {
    const need = Number((line.qtyPerUnit * order.quantity).toFixed(6));
    const lots = availableLotsForMaterial(line.materialId, algorithm);
    const material = store.getById('materials', line.materialId);
    const suitable = lots.find((l) => l.freeQty >= need);

    if (!suitable) {
      warnings.push({
        materialId: line.materialId,
        materialName: material?.name,
        need,
        message:
          lots.length === 0
            ? 'Нет доступных партий'
            : 'Нет одной партии с достаточным остатком (GMP: смешивание партий запрещено)',
        candidates: lots.slice(0, 5),
      });
      picks.push({
        materialId: line.materialId,
        materialName: material?.name,
        quantity: need,
        lotId: lots[0]?.id || null,
        lotNumber: lots[0]?.number || null,
        freeQty: lots[0]?.freeQty || 0,
        ok: false,
      });
    } else {
      picks.push({
        materialId: line.materialId,
        materialName: material?.name,
        quantity: need,
        lotId: suitable.id,
        lotNumber: suitable.number,
        counterpartyId: suitable.counterpartyId,
        counterpartyName: suitable.counterparty?.name,
        expiryDate: suitable.expiryDate,
        freeQty: suitable.freeQty,
        ok: true,
      });
    }
  }

  return { orderId, algorithm, picks, warnings };
}

export function confirmOrderSelection(orderIds) {
  const updated = [];
  for (const id of orderIds) {
    const order = store.getById('production_orders', id);
    if (!order) continue;
    if (order.status !== 'новый') continue;
    const next = store.update('production_orders', id, { status: 'спланирован' });
    updated.push(next);
  }
  return updated;
}

export function confirmMaterialPicks(orderId, picks) {
  if (!orderId) throw new Error('id required');
  const order = store.getById('production_orders', orderId);
  if (!order) throw new Error('Заказ не найден');

  // validate GMP: unique lot per material
  const byMat = new Map();
  for (const p of picks) {
    if (!p.lotId) throw new Error(`Не выбрана партия для материала ${p.materialId}`);
    if (byMat.has(p.materialId) && byMat.get(p.materialId) !== p.lotId) {
      throw new Error('GMP: нельзя резервировать две партии одного материала на одну серию');
    }
    byMat.set(p.materialId, p.lotId);
    const free = freeQtyByLot(p.lotId);
    if (free < Number(p.quantity)) {
      throw new Error(`Недостаточно свободного остатка по партии ${p.lotId}`);
    }
    const lot = store.getById('lots', p.lotId);
    if (!lot || lot.materialId !== p.materialId) {
      throw new Error('Партия не соответствует материалу');
    }
  }

  // remove old reservations for this order
  const oldRes = store.readAll('reservations').filter((r) => r.productionOrderId === orderId);
  if (oldRes.length) {
    store.removeMany(
      'reservations',
      oldRes.map((r) => r.id)
    );
  }

  const reservations = [];
  const lines = [];
  for (const p of picks) {
    const res = {
      id: cryptoRandom(),
      productionOrderId: orderId,
      materialId: p.materialId,
      quantity: Number(p.quantity),
      lotId: p.lotId,
      seriesId: order.seriesId,
    };
    store.create('reservations', res);
    reservations.push(res);
    lines.push({
      materialId: p.materialId,
      lotId: p.lotId,
      quantity: Number(p.quantity),
      reservationId: res.id,
    });
  }

  const updated = store.update('production_orders', orderId, {
    status: order.status === 'новый' ? 'спланирован' : order.status,
    lines,
  });

  return { order: updated, reservations };
}

function cryptoRandom() {
  return globalThis.crypto.randomUUID();
}

export function completeOrder(orderId) {
  const order = store.getById('production_orders', orderId);
  if (!order) throw new Error('Заказ не найден');
  if (order.status === 'завершен') return order;
  if (!order.lines?.length) throw new Error('Нет строк резерва — завершение невозможно');

  const movements = [];

  // списание компонентов
  for (const line of order.lines) {
    const stockRow = store.readAll('stock').find((s) => s.lotId === line.lotId);
    if (!stockRow || stockRow.quantity < line.quantity) {
      throw new Error(`Недостаточно запаса для списания партии ${line.lotId}`);
    }
    store.update('stock', stockRow.id, {
      quantity: Number((stockRow.quantity - line.quantity).toFixed(6)),
    });
    const mov = {
      id: cryptoRandom(),
      materialId: line.materialId,
      lotId: line.lotId,
      seriesId: order.seriesId,
      quantity: -Number(line.quantity),
      productionOrderId: orderId,
      type: 'issue',
      at: new Date().toISOString(),
    };
    store.create('material_movements', mov);
    movements.push(mov);
  }

  // приход ГП — создаём/увеличиваем партию серии
  let gpLot = store.readAll('lots').find((l) => l.number === `ГП-${store.getById('series', order.seriesId)?.number}`);
  if (!gpLot) {
    const series = store.getById('series', order.seriesId);
    gpLot = store.create('lots', {
      id: cryptoRandom(),
      number: `ГП-${series?.number || orderId.slice(0, 8)}`,
      materialId: order.materialId,
      counterpartyId: null,
      productionDate: new Date().toISOString().slice(0, 10),
      expiryDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 730).toISOString().slice(0, 10),
    });
    store.create('stock', {
      id: cryptoRandom(),
      materialId: order.materialId,
      lotId: gpLot.id,
      quantity: order.quantity,
    });
  } else {
    const stockRow = store.readAll('stock').find((s) => s.lotId === gpLot.id);
    if (stockRow) {
      store.update('stock', stockRow.id, {
        quantity: Number((stockRow.quantity + order.quantity).toFixed(6)),
      });
    }
  }

  const inMov = {
    id: cryptoRandom(),
    materialId: order.materialId,
    lotId: gpLot.id,
    seriesId: order.seriesId,
    quantity: Number(order.quantity),
    productionOrderId: orderId,
    type: 'receipt',
    at: new Date().toISOString(),
  };
  store.create('material_movements', inMov);
  movements.push(inMov);

  // снять резервы
  const res = store.readAll('reservations').filter((r) => r.productionOrderId === orderId);
  store.removeMany(
    'reservations',
    res.map((r) => r.id)
  );

  return {
    order: store.update('production_orders', orderId, { status: 'завершен', lines: order.lines }),
    movements,
  };
}

export function cancelOrder(orderId) {
  const order = store.getById('production_orders', orderId);
  if (!order) throw new Error('Заказ не найден');
  const res = store.readAll('reservations').filter((r) => r.productionOrderId === orderId);
  store.removeMany(
    'reservations',
    res.map((r) => r.id)
  );
  return store.update('production_orders', orderId, { status: 'отменен', lines: [] });
}
