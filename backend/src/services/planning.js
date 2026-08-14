import * as store from '../store.js';

export function warehouseByType(type) {
  return store.readAll('warehouses').find((w) => w.type === type) || null;
}

export function stockRowForLot(lotId, warehouseId) {
  const all = store.readAll('stock').filter((s) => s.lotId === lotId);
  if (warehouseId) {
    return all.find((s) => s.warehouseId === warehouseId) || all[0] || null;
  }
  return all[0] || null;
}

/** Свободный остаток партии = запас − активные резервы (legacy + документы) */
export function freeQtyByLot(lotId, excludeReservationIds = []) {
  const whComp = warehouseByType('компоненты')?.id;
  const stockRow = stockRowForLot(lotId, whComp);
  if (!stockRow) return 0;
  const reservedLegacy = store
    .readAll('reservations')
    .filter((r) => r.lotId === lotId && !excludeReservationIds.includes(r.id))
    .reduce((sum, r) => sum + Number(r.quantity || 0), 0);
  const reservedDocs = store
    .readAll('active_reservations')
    .filter((r) => r.lotId === lotId)
    .reduce((sum, r) => sum + Number(r.quantity || 0), 0);
  return Number((stockRow.quantity - reservedLegacy - reservedDocs).toFixed(6));
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
    // qtyPerUnit — кг на 1000 упаковок
    const need = Number(((Number(line.qtyPerUnit) * Number(order.quantity)) / 1000).toFixed(6));
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
        counterpartyId: lots[0]?.counterpartyId,
        counterpartyName: lots[0]?.counterparty?.name,
        expiryDate: lots[0]?.expiryDate,
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

/** Только проверка: заказы остаются «новый» до подтверждения резерва (вкладка 2). */
export function confirmOrderSelection(orderIds) {
  const selected = [];
  for (const id of orderIds) {
    const order = store.getById('production_orders', id);
    if (!order) throw new Error(`Заказ не найден: ${id}`);
    if (order.status !== 'новый') {
      throw new Error(`Заказ ${id} не в статусе «новый» (сейчас: ${order.status})`);
    }
    selected.push(order);
  }
  return selected;
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
    status: 'спланирован',
    lines,
    // стартовый факт = план (можно скорректировать на рабочем столе производства)
    actualQuantity: Number(order.quantity),
    actualLines: lines.map((l) => ({
      materialId: l.materialId,
      lotId: l.lotId,
      quantity: Number(l.quantity),
    })),
  });

  return { order: updated, reservations };
}

function cryptoRandom() {
  return globalThis.crypto.randomUUID();
}

/** Сохранить факт выпуска и фактический состав (до завершения) */
export function saveProductionFact(orderId, { actualQuantity, actualLines }) {
  const order = store.getById('production_orders', orderId);
  if (!order) throw new Error('Заказ не найден');
  if (order.status !== 'спланирован') {
    throw new Error(`Факт можно править только для статуса «спланирован» (сейчас: ${order.status})`);
  }
  if (!(Number(actualQuantity) > 0)) throw new Error('Фактический выпуск должен быть больше 0');
  if (!Array.isArray(actualLines) || !actualLines.length) {
    throw new Error('Укажите фактический состав компонентов');
  }
  for (const line of actualLines) {
    if (!line.materialId || !line.lotId) throw new Error('В факте у каждой строки должны быть материал и партия');
    if (!(Number(line.quantity) > 0)) throw new Error('Количество в факте должно быть больше 0');
    const lot = store.getById('lots', line.lotId);
    if (!lot || lot.materialId !== line.materialId) {
      throw new Error('Партия в факте не соответствует материалу');
    }
  }
  return store.update('production_orders', orderId, {
    actualQuantity: Number(actualQuantity),
    actualLines: actualLines.map((l) => ({
      materialId: l.materialId,
      lotId: l.lotId,
      quantity: Number(l.quantity),
    })),
  });
}

export function completeOrder(orderId) {
  const order = store.getById('production_orders', orderId);
  if (!order) throw new Error('Заказ не найден');

  const planLines = order.lines || [];
  const factLines =
    Array.isArray(order.actualLines) && order.actualLines.length > 0
      ? order.actualLines
      : planLines;
  const outputQty =
    order.actualQuantity != null && Number(order.actualQuantity) > 0
      ? Number(order.actualQuantity)
      : Number(order.quantity);

  if (!factLines.length) throw new Error('Нет строк состава — завершение невозможно');
  if (!(outputQty > 0)) throw new Error('Количество выпуска должно быть больше 0');

  const whComp = warehouseByType('компоненты')?.id;
  const whFg = warehouseByType('ГП')?.id;

  const existingIssues = store
    .readAll('material_movements')
    .filter((m) => m.productionOrderId === orderId && m.type === 'issue');
  const alreadyIssued = existingIssues.length > 0;
  const movements = [...existingIssues];

  // списание по ФАКТУ (один раз)
  if (!alreadyIssued) {
    for (const line of factLines) {
      const stockRow = stockRowForLot(line.lotId, whComp);
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
        warehouseId: stockRow.warehouseId || whComp,
        at: new Date().toISOString(),
      };
      store.create('material_movements', mov);
      movements.push(mov);
    }

    // приход ГП по фактическому выпуску
    const series = store.getById('series', order.seriesId);
    const gpNumber = `ГП-${series?.number || orderId.slice(0, 8)}`;
    let gpLot = store.readAll('lots').find((l) => l.number === gpNumber);
    if (!gpLot) {
      gpLot = store.create('lots', {
        id: cryptoRandom(),
        number: gpNumber,
        materialId: order.materialId,
        counterpartyId: null,
        productionDate: new Date().toISOString().slice(0, 10),
        expiryDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 730).toISOString().slice(0, 10),
      });
      store.create('stock', {
        id: cryptoRandom(),
        materialId: order.materialId,
        lotId: gpLot.id,
        warehouseId: whFg,
        quantity: outputQty,
      });
    } else {
      const stockRow = stockRowForLot(gpLot.id, whFg);
      if (stockRow) {
        store.update('stock', stockRow.id, {
          quantity: Number((stockRow.quantity + outputQty).toFixed(6)),
        });
      } else {
        store.create('stock', {
          id: cryptoRandom(),
          materialId: order.materialId,
          lotId: gpLot.id,
          warehouseId: whFg,
          quantity: outputQty,
        });
      }
    }

    const hasReceipt = store
      .readAll('material_movements')
      .some((m) => m.productionOrderId === orderId && m.type === 'receipt');
    if (!hasReceipt) {
      const inMov = {
        id: cryptoRandom(),
        materialId: order.materialId,
        lotId: gpLot.id,
        seriesId: order.seriesId,
        quantity: Number(outputQty),
        productionOrderId: orderId,
        type: 'receipt',
        warehouseId: whFg,
        at: new Date().toISOString(),
      };
      store.create('material_movements', inMov);
      movements.push(inMov);
    }
  }

  // снять резервы (по плану); списание уже по факту
  const res = store.readAll('reservations').filter((r) => r.productionOrderId === orderId);
  if (res.length) {
    store.removeMany(
      'reservations',
      res.map((r) => r.id)
    );
  }

  return {
    order: store.update('production_orders', orderId, {
      status: 'завершен',
      lines: planLines,
      actualQuantity: outputQty,
      actualLines: factLines,
    }),
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
  return store.update('production_orders', orderId, {
    status: 'отменен',
    lines: [],
    actualLines: [],
    actualQuantity: null,
  });
}

function dayKey(iso) {
  return String(iso).slice(0, 10);
}

function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function eachDay(from, to) {
  const out = [];
  let cur = from;
  while (cur <= to) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

/**
 * Матрица планового расходования: остаток материала по дням.
 * Остаток реконструируется: текущий запас + списания завершённых заказов периода,
 * затем по дням вычитаются расходы спланированных и завершённых заказов (дата начала).
 */
export function materialBalanceMatrix({ from, to } = {}) {
  const materials = store.readAll('materials');
  const series = store.readAll('series');
  const stock = store.readAll('stock');
  const orders = store
    .readAll('production_orders')
    .filter((o) => (o.status === 'спланирован' || o.status === 'завершен') && o.lines?.length);

  if (!orders.length) {
    return { dates: [], rows: [], from: from || null, to: to || null };
  }

  let rangeFrom = from || orders.reduce((m, o) => (dayKey(o.startAt) < m ? dayKey(o.startAt) : m), dayKey(orders[0].startAt));
  let rangeTo = to || orders.reduce((m, o) => (dayKey(o.endAt) > m ? dayKey(o.endAt) : m), dayKey(orders[0].endAt));
  if (rangeFrom > rangeTo) [rangeFrom, rangeTo] = [rangeTo, rangeFrom];

  const materialIds = new Set();
  for (const o of orders) {
    for (const line of o.lines || []) materialIds.add(line.materialId);
  }

  const dates = eachDay(rangeFrom, rangeTo);

  /** @type {Map<string, Map<string, { qty: number, orders: object[] }>>} */
  const consumeByMatDay = new Map();

  for (const o of orders) {
    const d = dayKey(o.startAt);
    if (d < rangeFrom || d > rangeTo) continue;
    const product = materials.find((m) => m.id === o.materialId);
    const ser = series.find((s) => s.id === o.seriesId);
    const orderLabel = `${product?.name || '—'} / ${ser?.number || '—'} (${o.status})`;

    for (const line of o.lines || []) {
      if (!consumeByMatDay.has(line.materialId)) consumeByMatDay.set(line.materialId, new Map());
      const byDay = consumeByMatDay.get(line.materialId);
      if (!byDay.has(d)) byDay.set(d, { qty: 0, orders: [] });
      const cell = byDay.get(d);
      const qty = Number(line.quantity) || 0;
      cell.qty = Number((cell.qty + qty).toFixed(6));
      const existing = cell.orders.find((x) => x.orderId === o.id);
      if (existing) {
        existing.quantity = Number((existing.quantity + qty).toFixed(6));
      } else {
        cell.orders.push({
          orderId: o.id,
          label: orderLabel,
          status: o.status,
          quantity: qty,
        });
      }
    }
  }

  const rows = [...materialIds]
    .map((materialId) => {
      const mat = materials.find((m) => m.id === materialId);
      const currentStock = stock
        .filter((s) => s.materialId === materialId)
        .reduce((sum, s) => sum + Number(s.quantity || 0), 0);

      // вернуть в «стартовый» остаток то, что уже списано завершёнными заказами периода
      let addBack = 0;
      for (const o of orders) {
        if (o.status !== 'завершен') continue;
        const d = dayKey(o.startAt);
        if (d < rangeFrom || d > rangeTo) continue;
        for (const line of o.lines || []) {
          if (line.materialId === materialId) addBack += Number(line.quantity) || 0;
        }
      }

      let balance = Number((currentStock + addBack).toFixed(6));
      const byDay = consumeByMatDay.get(materialId) || new Map();
      const cells = dates.map((date) => {
        const cons = byDay.get(date);
        const consumed = cons?.qty || 0;
        if (consumed) balance = Number((balance - consumed).toFixed(6));
        return {
          date,
          balance,
          consumed,
          orders: cons?.orders || [],
        };
      });

      return {
        materialId,
        materialName: mat?.name || materialId,
        unit: mat?.unit || '',
        openingBalance: Number((currentStock + addBack).toFixed(6)),
        cells,
      };
    })
    .sort((a, b) => a.materialName.localeCompare(b.materialName, 'ru'));

  return { dates, rows, from: rangeFrom, to: rangeTo };
}
