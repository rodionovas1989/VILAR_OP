import { randomUUID } from 'crypto';
import * as store from '../store.js';
import {
  DOCUMENT_TYPES,
  DOCUMENT_STATUS,
  assertDocumentType,
  collectionForType,
} from '../constants/documentTypes.js';
import { freeQtyByLot, stockRowForLot } from './stock.js';
import { appendDocumentStatusLog } from './documentStatusLog.js';
import {
  appendProductionMovement,
  cancelProductionMovementsForDocument,
} from './productionRegister.js';

function cryptoRandom() {
  return randomUUID();
}

function logDocStatus(action, doc, { fromStatus, toStatus, userId } = {}) {
  if (!doc) return;
  appendDocumentStatusLog({
    action,
    documentType: doc.type,
    documentId: doc.id,
    documentNumber: doc.number,
    fromStatus: fromStatus ?? null,
    toStatus: toStatus ?? doc.status ?? null,
    userId: userId || null,
    productionOrderId: doc.productionOrderId || null,
  });
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function normalizeTime(value) {
  if (value == null || value === '') return null;
  const t = String(value).trim();
  if (!/^\d{2}:\d{2}$/.test(t)) throw new Error('Некорректное время (ожидается ЧЧ:ММ)');
  const [h, m] = t.split(':').map(Number);
  if (h > 23 || m > 59) throw new Error('Некорректное время (ожидается ЧЧ:ММ)');
  return t;
}

function assertUserExists(userId) {
  if (!userId) throw new Error('Укажите пользователя');
  if (!store.getById('users', userId)) throw new Error('Пользователь не найден');
}

function roundQty(n) {
  return Number(Number(n).toFixed(6));
}

/** {TYPE}:{YYYY-MM-DD} → следующий NNNNN */
export function nextDocumentNumber(type, dateStr = todayIso()) {
  assertDocumentType(type);
  const code = DOCUMENT_TYPES[type].code;
  const key = `${code}:${dateStr}`;
  const sequences = store.readAll('document_sequences');
  const row = sequences.find((s) => s.key === key);
  const next = (row?.last ?? 0) + 1;
  if (row) {
    store.update('document_sequences', row.id, { last: next });
  } else {
    store.create('document_sequences', { id: cryptoRandom(), key, last: next });
  }
  const seq = String(next).padStart(5, '0');
  return `${code}-${dateStr}-${seq}`;
}

function assertDraft(doc) {
  if (doc.status !== 'draft') {
    throw new Error(`Документ ${doc.number} не в статусе «Создан» (сейчас: ${DOCUMENT_STATUS[doc.status] || doc.status})`);
  }
}

function assertPosted(doc) {
  if (doc.status !== 'posted') {
    throw new Error(`Документ ${doc.number} не проведён (сейчас: ${DOCUMENT_STATUS[doc.status] || doc.status})`);
  }
}

function validateLines(lines, docType) {
  if (!Array.isArray(lines) || !lines.length) {
    if (docType === 'inventory') return; // черновик может быть пустым до заполнения склада
    throw new Error('Добавьте хотя бы одну строку в табличную часть');
  }
  for (const line of lines) {
    if (!line.materialId || !line.lotId) throw new Error('В каждой строке укажите материал и партию');
    const lot = store.getById('lots', line.lotId);
    if (!lot || lot.materialId !== line.materialId) {
      throw new Error('Партия не соответствует материалу в строке');
    }
    if (docType === 'inventory') {
      const book = line.bookQuantity != null ? line.bookQuantity : line.quantity;
      const actual = line.actualQuantity != null ? line.actualQuantity : line.quantity;
      if (book == null || actual == null) {
        throw new Error('Для инвентаризации укажите учётное и фактическое количество');
      }
      if (Number(book) < 0 || Number(actual) < 0) {
        throw new Error('Количество в инвентаризации не может быть отрицательным');
      }
    } else if (!(Number(line.quantity) > 0)) {
      throw new Error('Количество в строке должно быть больше 0');
    }
  }
}

function normalizeLines(lines, docType = null) {
  return lines.map((l) => {
    const bookQuantity = l.bookQuantity != null ? roundQty(l.bookQuantity) : undefined;
    const actualQuantity = l.actualQuantity != null ? roundQty(l.actualQuantity) : undefined;
    let quantity = roundQty(l.quantity);
    if (docType === 'inventory') {
      if (actualQuantity != null) quantity = actualQuantity;
      else if (bookQuantity != null && !(Number(quantity) > 0)) quantity = bookQuantity;
    }
    return {
      id: l.id || cryptoRandom(),
      materialId: l.materialId,
      lotId: l.lotId,
      quantity,
      bookQuantity,
      actualQuantity,
    };
  });
}

function validateWarehouses(doc) {
  const meta = DOCUMENT_TYPES[doc.type];
  if (meta.warehouseMode === 'to' && !doc.warehouseToId) {
    throw new Error('Укажите склад назначения');
  }
  if (meta.warehouseMode === 'from' && !doc.warehouseFromId) {
    throw new Error('Укажите склад-источник');
  }
  if (meta.warehouseMode === 'single' && !doc.warehouseId) {
    throw new Error('Укажите склад');
  }
  if (meta.warehouseMode === 'both') {
    if (!doc.warehouseFromId || !doc.warehouseToId) {
      throw new Error('Укажите склады «откуда» и «куда»');
    }
    if (doc.warehouseFromId === doc.warehouseToId) {
      throw new Error('Склады перемещения должны различаться');
    }
  }
}

function movementBase(doc) {
  return {
    documentId: doc.id,
    documentNumber: doc.number,
    documentType: doc.type,
    documentStatus: doc.status,
  };
}

function appendReservationHistory(doc, action, lines, extra = {}) {
  const at = new Date().toISOString();
  for (const line of lines) {
    store.create('reservation_history', {
      id: cryptoRandom(),
      at,
      action,
      documentId: doc.id,
      documentNumber: doc.number,
      documentType: doc.type,
      documentStatus: doc.status,
      materialId: line.materialId,
      lotId: line.lotId,
      quantity: line.quantity,
      productionOrderId: doc.productionOrderId || null,
      userId: extra.userId || doc.createdByUserId,
      basisDocumentId: extra.basisDocumentId || null,
      basisDocumentNumber: extra.basisDocumentNumber || null,
    });
  }
}

function clearActiveReservationsForDocument(documentId) {
  const active = store.readAll('active_reservations').filter((r) => r.documentId === documentId);
  if (active.length) {
    store.removeMany(
      'active_reservations',
      active.map((r) => r.id)
    );
  }
  return active;
}

function applyStockDelta(materialId, lotId, warehouseId, delta, doc, extra = {}) {
  const qtyDelta = roundQty(delta);
  let stockRow = store
    .readAll('stock')
    .find((s) => s.lotId === lotId && s.warehouseId === warehouseId);
  if (!stockRow && qtyDelta > 0) {
    stockRow = store.create('stock', {
      id: cryptoRandom(),
      materialId,
      lotId,
      warehouseId,
      quantity: 0,
    });
  }
  if (!stockRow) throw new Error(`Нет остатка по партии ${lotId} на складе`);
  const nextQty = roundQty(Number(stockRow.quantity) + qtyDelta);
  if (nextQty < -1e-9) throw new Error(`Недостаточно остатка по партии ${lotId}`);
  store.update('stock', stockRow.id, { quantity: nextQty });

  store.create('material_movements', {
    id: cryptoRandom(),
    materialId,
    lotId,
    seriesId: extra.seriesId || null,
    quantity: qtyDelta,
    productionOrderId: extra.productionOrderId || doc.productionOrderId || null,
    type: qtyDelta >= 0 ? 'receipt' : 'issue',
    warehouseId,
    userId: extra.userId || doc.postedByUserId || doc.createdByUserId || null,
    at: new Date().toISOString(),
    ...movementBase(doc),
  });
}

function postReceipt(doc, userId) {
  const wh = doc.warehouseToId;
  for (const line of doc.lines) {
    applyStockDelta(line.materialId, line.lotId, wh, line.quantity, doc, { userId });
  }
}

function postWriteoff(doc) {
  const wh = doc.warehouseFromId;
  for (const line of doc.lines) {
    applyStockDelta(line.materialId, line.lotId, wh, -line.quantity, doc);
  }
}

function postPosting(doc) {
  const wh = doc.warehouseToId;
  for (const line of doc.lines) {
    applyStockDelta(line.materialId, line.lotId, wh, line.quantity, doc);
  }
}

function postTransfer(doc) {
  for (const line of doc.lines) {
    applyStockDelta(line.materialId, line.lotId, doc.warehouseFromId, -line.quantity, doc);
    applyStockDelta(line.materialId, line.lotId, doc.warehouseToId, line.quantity, doc);
  }
}

function postShipment(doc) {
  postWriteoff(doc);
}

function postProductionIssue(doc) {
  postWriteoff(doc);
  for (const line of doc.lines) {
    appendProductionMovement(doc, line, -Number(line.quantity));
  }
}

function postProductionReceipt(doc) {
  postPosting(doc);
  for (const line of doc.lines) {
    appendProductionMovement(doc, line, Number(line.quantity));
  }
}

function postReservation(doc, userId) {
  const wh = doc.warehouseId;
  for (const line of doc.lines) {
    const stockRow = stockRowForLot(line.lotId, wh);
    if (!stockRow) throw new Error(`Нет остатка по партии ${line.lotId}`);
    const free = freeQtyByLot(line.lotId, { warehouseId: wh });
    if (free < line.quantity) {
      throw new Error(`Недостаточно свободного остатка по партии ${line.lotId}`);
    }
    store.create('active_reservations', {
      id: cryptoRandom(),
      documentId: doc.id,
      productionOrderId: doc.productionOrderId || null,
      materialId: line.materialId,
      lotId: line.lotId,
      quantity: line.quantity,
      seriesId: doc.seriesId || null,
      warehouseId: wh,
    });
  }
  appendReservationHistory(doc, 'post', doc.lines, { userId });
}

/** Остатки склада → строки плана инвентаризации (quantity > 0). */
export function stockLinesForWarehouse(warehouseId) {
  if (!warehouseId) return [];
  return store
    .readAll('stock')
    .filter((s) => s.warehouseId === warehouseId && Number(s.quantity) > 0)
    .map((s) => ({
      materialId: s.materialId,
      lotId: s.lotId,
      bookQuantity: roundQty(s.quantity),
    }))
    .sort(
      (a, b) =>
        String(a.materialId).localeCompare(String(b.materialId)) ||
        String(a.lotId).localeCompare(String(b.lotId))
    );
}

/** Предзаполнение UI: план + факт = book. */
export function inventoryStockPreview(warehouseId) {
  if (!warehouseId) throw new Error('Укажите склад');
  if (!store.getById('warehouses', warehouseId)) throw new Error('Склад не найден');
  const plan = stockLinesForWarehouse(warehouseId);
  return {
    warehouseId,
    lines: plan.map((row) => ({
      materialId: row.materialId,
      lotId: row.lotId,
      bookQuantity: row.bookQuantity,
      actualQuantity: row.bookQuantity,
      quantity: row.bookQuantity,
    })),
  };
}

function inventoryDeltas(doc) {
  const shortage = [];
  const surplus = [];
  for (const line of doc.lines || []) {
    const book = roundQty(line.bookQuantity != null ? line.bookQuantity : 0);
    const actual = roundQty(line.actualQuantity != null ? line.actualQuantity : line.quantity || 0);
    const delta = roundQty(actual - book);
    if (Math.abs(delta) < 1e-9) continue;
    const row = {
      materialId: line.materialId,
      lotId: line.lotId,
      quantity: roundQty(Math.abs(delta)),
    };
    if (delta < 0) shortage.push(row);
    else surplus.push(row);
  }
  return { shortage, surplus };
}

function findInventoryChildDocs(invId) {
  const out = [];
  for (const type of ['writeoff', 'posting']) {
    for (const d of store.readAll(collectionForType(type))) {
      if (d.basisDocumentId === invId) out.push(d);
    }
  }
  return out;
}

/**
 * INV не меняет склад. При ненулевой дельте создаёт черновики WOF и/или PST
 * с basisDocumentId = INV.id; ссылки пишутся в linkedWriteoffId / linkedPostingId.
 */
function postInventory(doc, userId) {
  const wh = doc.warehouseId;
  if (!wh) throw new Error('Укажите склад');
  const { shortage, surplus } = inventoryDeltas(doc);
  const comment = `По инвентаризации ${doc.number}`;
  let linkedWriteoffId = null;
  let linkedPostingId = null;

  if (shortage.length) {
    const wof = createDocumentUnchecked('writeoff', {
      createdByUserId: userId,
      warehouseFromId: wh,
      basisDocumentId: doc.id,
      comment,
      lines: shortage,
    });
    linkedWriteoffId = wof.id;
  }
  if (surplus.length) {
    const pst = createDocumentUnchecked('posting', {
      createdByUserId: userId,
      warehouseToId: wh,
      basisDocumentId: doc.id,
      comment,
      lines: surplus,
    });
    linkedPostingId = pst.id;
  }

  updateDocRecord(doc, { linkedWriteoffId, linkedPostingId });
}

const POST_HANDLERS = {
  receipt: postReceipt,
  writeoff: postWriteoff,
  posting: postPosting,
  transfer: postTransfer,
  shipment: postShipment,
  production_issue: postProductionIssue,
  production_receipt: postProductionReceipt,
  reservation: postReservation,
  inventory: postInventory,
};

function docCollection(doc) {
  return collectionForType(doc.type);
}

/** Поиск документа по id среди всех типов */
export function findDocumentById(id) {
  for (const type of Object.keys(DOCUMENT_TYPES)) {
    const doc = store.getById(collectionForType(type), id);
    if (doc) return doc;
  }
  // legacy
  return store.getById('stock_documents', id);
}

export function getDocument(type, id) {
  assertDocumentType(type);
  return store.getById(collectionForType(type), id);
}

function updateDocRecord(doc, patch) {
  return store.update(docCollection(doc), doc.id, patch);
}

export function listDocuments(type, filter = {}) {
  assertDocumentType(type);
  let rows = store.readAll(collectionForType(type));
  if (filter.status) rows = rows.filter((d) => d.status === filter.status);
  if (filter.productionOrderId) {
    rows = rows.filter((d) => d.productionOrderId === filter.productionOrderId);
  }
  return rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export function findReservationDocumentForOrder(productionOrderId, statuses = ['posted']) {
  return store
    .readAll(collectionForType('reservation'))
    .find((d) => d.productionOrderId === productionOrderId && statuses.includes(d.status));
}

export function createDocument(type, payload) {
  return store.runWrite(() => createDocumentUnchecked(type, payload));
}

export function createDocumentUnchecked(type, payload) {
  assertDocumentType(type);
  const userId = payload.createdByUserId;
  if (!userId) throw new Error('Укажите пользователя (createdByUserId)');
  if (!store.getById('users', userId)) throw new Error('Пользователь не найден');

  const date = payload.date || todayIso();
  const time = normalizeTime(payload.time ?? nowTime());
  const number = nextDocumentNumber(type, date);
  const lines = normalizeLines(payload.lines || [], type);

  const doc = {
    id: cryptoRandom(),
    type,
    number,
    date,
    time,
    status: 'draft',
    warehouseId: payload.warehouseId || null,
    warehouseFromId: payload.warehouseFromId || null,
    warehouseToId: payload.warehouseToId || null,
    productionOrderId: payload.productionOrderId || null,
    seriesId: payload.seriesId || null,
    basisDocumentId: payload.basisDocumentId || null,
    linkedWriteoffId: payload.linkedWriteoffId || null,
    linkedPostingId: payload.linkedPostingId || null,
    createdByUserId: userId,
    createdAt: new Date().toISOString(),
    postedAt: null,
    postedByUserId: null,
    cancelledAt: null,
    cancelledByUserId: null,
    fulfilledAt: null,
    fulfilledByUserId: null,
    comment: payload.comment || '',
    lines,
  };

  validateWarehouses(doc);
  if (lines.length) validateLines(lines, type);

  const created = store.create(collectionForType(type), doc);
  logDocStatus('create', created, { fromStatus: null, toStatus: 'draft', userId });
  return created;
}

export function updateDocument(type, id, patch, userId = null) {
  const current = getDocument(type, id);
  if (!current) throw new Error('Документ не найден');
  assertDraft(current);

  const merged = {
    ...current,
    ...patch,
    id: current.id,
    type: current.type,
    number: current.number,
    status: current.status,
    lines: patch.lines != null ? normalizeLines(patch.lines, type) : current.lines,
  };

  validateWarehouses(merged);
  if (merged.lines.length) validateLines(merged.lines, merged.type);

  return store.runWrite(() => {
    const updated = store.update(collectionForType(type), id, {
      date: merged.date,
      time: merged.time != null ? normalizeTime(merged.time) : current.time ?? null,
      warehouseId: merged.warehouseId,
      warehouseFromId: merged.warehouseFromId,
      warehouseToId: merged.warehouseToId,
      productionOrderId: merged.productionOrderId,
      seriesId: merged.seriesId,
      basisDocumentId: merged.basisDocumentId,
      comment: merged.comment,
      lines: merged.lines,
    });
    logDocStatus('save', updated, {
      fromStatus: 'draft',
      toStatus: 'draft',
      userId: userId || updated?.createdByUserId,
    });
    return updated;
  });
}

export function deleteDocument(type, id) {
  const doc = getDocument(type, id);
  if (!doc) throw new Error('Документ не найден');
  assertDraft(doc);
  store.removeMany(collectionForType(type), [id]);
  return { deleted: 1 };
}

export function listDocumentsForOrder(type, productionOrderId, statuses) {
  return listDocuments(type, { productionOrderId }).filter((d) =>
    statuses ? statuses.includes(d.status) : true
  );
}

export function postDocument(type, id, userId) {
  return store.runWrite(() => postDocumentUnchecked(type, id, userId));
}

export function postDocumentUnchecked(type, id, userId, opts = {}) {
  const doc = getDocument(type, id);
  if (!doc) throw new Error('Документ не найден');
  assertDraft(doc);
  assertUserExists(userId);
  validateWarehouses(doc);
  validateLines(doc.lines, doc.type);

  const handler = POST_HANDLERS[doc.type];
  if (!handler) throw new Error(`Проведение типа «${doc.type}» пока не реализовано`);

  const postedView = {
    ...doc,
    status: 'posted',
    postedAt: new Date().toISOString(),
    postedByUserId: userId,
  };
  handler(postedView, userId);
  const posted = updateDocRecord(doc, {
    status: 'posted',
    postedAt: postedView.postedAt,
    postedByUserId: userId,
  });
  // inventory пишет linked* внутри handler — вернуть актуальный снимок
  const result =
    doc.type === 'inventory' ? getDocument(type, id) || posted : posted;
  if (!opts.skipLog) {
    logDocStatus('post', result, { fromStatus: 'draft', toStatus: 'posted', userId });
  }
  return result;
}

export function repostDocument(type, id, userId, patch = {}) {
  return store.runWrite(() => {
    const doc = getDocument(type, id);
    if (!doc) throw new Error('Документ не найден');
    if (doc.status !== 'posted') {
      throw new Error('Повторное проведение доступно только для проведённых документов');
    }
    assertUserExists(userId);

    if (doc.type === 'inventory') {
      throw new Error(
        'Повторное проведение инвентаризации недоступно — отмените документ и создайте новый'
      );
    }

    if (doc.type === 'reservation') {
      clearActiveReservationsForDocument(doc.id);
      appendReservationHistory(doc, 'cancel', doc.lines, { userId });
    } else {
      reverseStockMovements(doc, userId);
    }

    const merged = {
      ...doc,
      ...patch,
      id: doc.id,
      type: doc.type,
      number: doc.number,
      lines: patch.lines != null ? normalizeLines(patch.lines, type) : doc.lines,
    };

    validateWarehouses(merged);
    validateLines(merged.lines, merged.type);

    store.update(collectionForType(type), id, {
      status: 'draft',
      postedAt: null,
      postedByUserId: null,
      date: merged.date,
      time: merged.time != null ? normalizeTime(merged.time) : doc.time ?? null,
      warehouseId: merged.warehouseId,
      warehouseFromId: merged.warehouseFromId,
      warehouseToId: merged.warehouseToId,
      productionOrderId: merged.productionOrderId,
      seriesId: merged.seriesId,
      basisDocumentId: merged.basisDocumentId,
      comment: merged.comment,
      lines: merged.lines,
    });

    const posted = postDocumentUnchecked(type, id, userId, { skipLog: true });
    logDocStatus('repost', posted, { fromStatus: 'posted', toStatus: 'posted', userId });
    return posted;
  });
}

function reverseStockMovements(doc, userId) {
  const movements = store
    .readAll('material_movements')
    .filter((m) => m.documentId === doc.id && m.documentStatus !== 'cancelled');

  for (const mov of movements) {
    applyStockDelta(mov.materialId, mov.lotId, mov.warehouseId, -mov.quantity, doc, {
      productionOrderId: mov.productionOrderId,
      seriesId: mov.seriesId,
    });
  }

  const reversed = store.readAll('material_movements').filter((m) => m.documentId === doc.id);
  for (const m of reversed) {
    store.update('material_movements', m.id, { documentStatus: 'cancelled' });
  }
  cancelProductionMovementsForDocument(doc.id);
}

export function cancelDocument(type, id, userId) {
  return store.runWrite(() => cancelDocumentUnchecked(type, id, userId));
}

export function cancelDocumentUnchecked(type, id, userId) {
  const doc = getDocument(type, id);
  if (!doc) throw new Error('Документ не найден');
  if (doc.status !== 'posted' && doc.status !== 'draft') {
    throw new Error(`Нельзя отменить документ в статусе «${DOCUMENT_STATUS[doc.status]}»`);
  }
  if (doc.status === 'draft') {
    const cancelled = store.update(collectionForType(type), id, {
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
      cancelledByUserId: userId,
    });
    logDocStatus('cancel', cancelled, { fromStatus: 'draft', toStatus: 'cancelled', userId });
    return cancelled;
  }

  assertPosted(doc);

  if (doc.type === 'inventory') {
    const children = findInventoryChildDocs(doc.id);
    const postedChild = children.find((c) => c.status === 'posted');
    if (postedChild) {
      throw new Error(
        `Нельзя отменить инвентаризацию: связанный документ ${postedChild.number} уже проведён`
      );
    }
    for (const child of children) {
      if (child.status === 'draft') {
        store.removeMany(collectionForType(child.type), [child.id]);
      }
    }
    const cancelled = store.update(collectionForType(type), id, {
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
      cancelledByUserId: userId,
      linkedWriteoffId: null,
      linkedPostingId: null,
    });
    logDocStatus('cancel', cancelled, { fromStatus: 'posted', toStatus: 'cancelled', userId });
    return cancelled;
  }

  if (doc.type === 'reservation') {
    clearActiveReservationsForDocument(doc.id);
    const cancelled = store.update(collectionForType(type), id, {
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
      cancelledByUserId: userId,
    });
    appendReservationHistory(cancelled, 'cancel', doc.lines, { userId });
    logDocStatus('cancel', cancelled, { fromStatus: 'posted', toStatus: 'cancelled', userId });
    return cancelled;
  }

  reverseStockMovements(doc, userId);
  const cancelled = store.update(collectionForType(type), id, {
    status: 'cancelled',
    cancelledAt: new Date().toISOString(),
    cancelledByUserId: userId,
  });
  logDocStatus('cancel', cancelled, { fromStatus: 'posted', toStatus: 'cancelled', userId });
  return cancelled;
}

export function fulfillDocument(type, id, userId, basis = {}) {
  return store.runWrite(() => fulfillDocumentUnchecked(type, id, userId, basis));
}

export function fulfillDocumentUnchecked(type, id, userId, basis = {}) {
  const doc = getDocument(type, id);
  if (!doc) throw new Error('Документ не найден');
  if (doc.type !== 'reservation') {
    throw new Error('Статус «Выполнен» доступен только для документов резервирования');
  }
  assertPosted(doc);

  clearActiveReservationsForDocument(doc.id);
  const fulfilled = store.update(collectionForType(type), id, {
    status: 'fulfilled',
    fulfilledAt: new Date().toISOString(),
    fulfilledByUserId: userId,
    basisDocumentId: basis.basisDocumentId || doc.basisDocumentId || null,
  });

  appendReservationHistory(fulfilled, 'fulfill', doc.lines, {
    userId,
    basisDocumentId: basis.basisDocumentId || null,
    basisDocumentNumber: basis.basisDocumentNumber || null,
  });

  logDocStatus('fulfill', fulfilled, { fromStatus: 'posted', toStatus: 'fulfilled', userId });
  return fulfilled;
}

/** Отмена проведённого RES и создание нового черновика (перепланирование) */
export function replaceReservationDocument(oldDocId, userId, newLines) {
  return store.runWrite(() => {
    const oldDoc = findDocumentById(oldDocId);
    if (!oldDoc || oldDoc.type !== 'reservation') throw new Error('Документ резервирования не найден');
    if (oldDoc.status === 'posted' || oldDoc.status === 'draft') {
      cancelDocumentUnchecked('reservation', oldDocId, userId);
    }

    return createDocumentUnchecked('reservation', {
      date: todayIso(),
      createdByUserId: userId,
      warehouseId: oldDoc.warehouseId,
      productionOrderId: oldDoc.productionOrderId,
      seriesId: oldDoc.seriesId,
      lines: newLines,
      comment: oldDoc.comment,
    });
  });
}

function summarizeDocument(d) {
  return {
    id: d.id,
    type: d.type,
    number: d.number,
    status: d.status,
    date: d.date,
    productionOrderId: d.productionOrderId || null,
    basisDocumentId: d.basisDocumentId || null,
  };
}

/** Движения, регистры и связанные документы — для отладки и просмотра из карточки. */
export function getDocumentTrace(type, id) {
  const doc = getDocument(type, id);
  if (!doc) return null;

  const movements = store
    .readAll('material_movements')
    .filter((m) => m.documentId === id || m.documentNumber === doc.number)
    .sort((a, b) => String(b.at).localeCompare(String(a.at)));

  const reservationHistory = store
    .readAll('reservation_history')
    .filter((h) => h.documentId === id || h.basisDocumentId === id)
    .sort((a, b) => String(b.at).localeCompare(String(a.at)));

  const activeReservations = store
    .readAll('active_reservations')
    .filter((r) => r.documentId === id);

  const relatedDocuments = [];
  for (const t of Object.keys(DOCUMENT_TYPES)) {
    for (const d of store.readAll(collectionForType(t))) {
      if (d.id === id) continue;
      const linked =
        (doc.productionOrderId && d.productionOrderId === doc.productionOrderId) ||
        d.basisDocumentId === id ||
        (doc.basisDocumentId && doc.basisDocumentId === d.id);
      if (linked) relatedDocuments.push(summarizeDocument(d));
    }
  }
  relatedDocuments.sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.number).localeCompare(String(a.number)));

  const productionOrder = doc.productionOrderId
    ? store.getById('production_orders', doc.productionOrderId)
    : null;

  const lotIds = [...new Set(doc.lines.map((l) => l.lotId).filter(Boolean))];
  const stock = store.readAll('stock').filter((s) => lotIds.includes(s.lotId));

  return {
    document: summarizeDocument(doc),
    movements,
    reservationHistory,
    activeReservations,
    relatedDocuments,
    productionOrder: productionOrder
      ? {
          id: productionOrder.id,
          status: productionOrder.status,
          quantity: productionOrder.quantity,
          seriesId: productionOrder.seriesId,
          materialId: productionOrder.materialId,
        }
      : null,
    stock,
  };
}

export function getOrderTrace(orderId) {
  const order = store.getById('production_orders', orderId);
  if (!order) return null;
  const documents = [];
  for (const t of Object.keys(DOCUMENT_TYPES)) {
    documents.push(...listDocuments(t, { productionOrderId: orderId }).map(summarizeDocument));
  }
  const docIds = new Set(documents.map((d) => d.id));
  const movements = store
    .readAll('material_movements')
    .filter((m) => m.productionOrderId === orderId || docIds.has(m.documentId))
    .sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const reservationHistory = store
    .readAll('reservation_history')
    .filter((h) => h.productionOrderId === orderId || docIds.has(h.documentId))
    .sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const activeReservations = store
    .readAll('active_reservations')
    .filter((r) => r.productionOrderId === orderId);
  return {
    productionOrder: {
      id: order.id,
      status: order.status,
      quantity: order.quantity,
      seriesId: order.seriesId,
      materialId: order.materialId,
    },
    documents,
    movements,
    reservationHistory,
    activeReservations,
  };
}
