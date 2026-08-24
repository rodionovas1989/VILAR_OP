import { randomUUID } from 'crypto';
import * as store from '../store.js';
import * as documents from './documents.js';
import * as productionRegister from './productionRegister.js';
import { warehouseByType, stockRowForLot, freeQtyByLot } from './stock.js';
import { resolveLotQuality, assertLotsQualityForUse } from './quality.js';
import { onLotCreated } from './scenarios.js';
import {
  candidateMaterials,
  isAllowedSubstitute,
  substitutionRuleId,
} from './substitutions.js';
import { computeLineNeed } from './lotRecalc.js';
import { getLotCharacteristicMap, missingRequiredMessages } from './characteristics.js';
import { recalcMissingMessage } from '../constants/lotCharacteristics.js';

export { warehouseByType, stockRowForLot, freeQtyByLot };

const ORDER_STATUS = {
  new: 'новый',
  planned: 'спланирован',
  done: 'завершен',
  cancelled: 'отменен',
};

function assertOrderStatus(order, allowed, action) {
  if (!allowed.includes(order.status)) {
    throw new Error(
      `${action}: заказ в статусе «${order.status}», допустимо: ${allowed.map((s) => `«${s}»`).join(', ')}`
    );
  }
}

function resolveActorUserId(userId) {
  if (userId && store.getById('users', userId)) return userId;
  throw new Error('Не авторизован: нет пользователя для проведения. Войдите в систему.');
}

export function availableLotsForMaterial(materialId, algorithm = 'FEFO') {
  const lots = store
    .readAll('lots')
    .filter((l) => l.materialId === materialId)
    .map((l) => {
      const quality = resolveLotQuality(l.id);
      return {
        ...l,
        freeQty: freeQtyByLot(l.id),
        counterparty: store.getById('counterparties', l.counterpartyId),
        manufacturer: store.getById('manufacturers', l.manufacturerId),
        qualityPermission: quality.permission,
        qualityPermissionLabel: quality.permissionLabel,
        qualityName: quality.qualityName,
        qualityMessage: quality.message,
        qualityAllowed: quality.allowed,
        qualityDefaulted: quality.defaulted,
        characteristicValues: getLotCharacteristicMap(l.id),
      };
    })
    .filter((l) => l.freeQty > 0 && new Date(l.expiryDate) >= new Date());

  lots.sort((a, b) => {
    if (algorithm === 'FIFO') {
      return new Date(a.productionDate) - new Date(b.productionDate);
    }
    return new Date(a.expiryDate) - new Date(b.expiryDate);
  });
  return lots;
}

function pickPayload(line, specMaterial, cand, lot, needResult, allowedMaterialIds, ok) {
  const material = store.getById('materials', cand.materialId);
  return {
    specLineId: line.id,
    specMaterialId: line.materialId,
    specMaterialName: specMaterial?.name,
    materialId: cand.materialId,
    materialName: material?.name,
    substituted: cand.materialId !== line.materialId,
    substitutionRuleId: cand.ruleId || null,
    allowedMaterialIds,
    qtyPerUnit: Number(line.qtyPerUnit) || 0,
    recalcMethod: needResult.method === 'assay_and_dry' ? 'assay_and_dry' : 'none',
    recalcXLabel: line.recalcXLabel ?? null,
    nominalQuantity: needResult.nominal,
    quantity: needResult.quantity,
    recalcApplied: needResult.applied,
    recalcMissing: needResult.missing,
    recalcUseAssay: needResult.useAssay,
    recalcUseLod: needResult.useLod,
    recalcSnapshot: needResult.snapshot,
    ...lotFields(lot),
    ok,
  };
}

function findSpecLine(spec, pick) {
  const lines = spec.lines || [];
  if (pick?.specLineId) {
    const byId = lines.find((l) => l.id === pick.specLineId);
    if (byId) return byId;
  }
  const specMat = pick?.specMaterialId || pick?.materialId;
  return lines.find((l) => l.materialId === specMat) || null;
}

function lotFields(lot) {
  return {
    lotId: lot?.id || null,
    lotNumber: lot?.number || null,
    counterpartyId: lot?.counterpartyId,
    counterpartyName: lot?.counterparty?.name,
    manufacturerId: lot?.manufacturerId,
    manufacturerName: lot?.manufacturer?.name,
    expiryDate: lot?.expiryDate,
    freeQty: lot?.freeQty || 0,
    qualityPermission: lot?.qualityPermission,
    qualityPermissionLabel: lot?.qualityPermissionLabel,
    qualityName: lot?.qualityName,
    qualityMessage: lot?.qualityMessage,
    qualityAllowed: lot?.qualityAllowed,
    characteristicValues: lot?.characteristicValues || (lot?.id ? getLotCharacteristicMap(lot.id) : {}),
  };
}

/**
 * GMP: одна партия на один компонент в рамках серии/заказа.
 * Не дробим потребность по нескольким партиям.
 * Если по материалу спеки нет партии — пробуем аналоги (без транзитивности).
 */
export function suggestPicksForOrder(orderId, algorithm = 'FEFO') {
  const order = store.getById('production_orders', orderId);
  if (!order) throw new Error('Заказ не найден');
  const spec = store.getById('specifications', order.specificationId);
  if (!spec) throw new Error('Спецификация не найдена');

  const picks = [];
  const warnings = [];

  for (const line of spec.lines || []) {
    const specMaterial = store.getById('materials', line.materialId);
    const candidates = candidateMaterials(line.materialId, spec.id);
    const allowedMaterialIds = candidates.map((c) => c.materialId);

    let chosenCand = candidates[0];
    let suitable = null;
    let suitableNeed = computeLineNeed(line, order.quantity, null);

    for (const cand of candidates) {
      const lots = availableLotsForMaterial(cand.materialId, algorithm);
      const hit = lots.find((l) => {
        const need = computeLineNeed(line, order.quantity, l);
        return l.freeQty >= need.quantity && l.qualityAllowed !== false;
      });
      if (hit) {
        chosenCand = cand;
        suitable = hit;
        suitableNeed = computeLineNeed(line, order.quantity, hit);
        break;
      }
    }

    if (!suitable) {
      const triedLots = availableLotsForMaterial(chosenCand.materialId, algorithm);
      const fallback = triedLots[0] || null;
      const fallbackNeed = computeLineNeed(line, order.quantity, fallback);
      const anyQty = triedLots.find((l) => {
        const need = computeLineNeed(line, order.quantity, l);
        return l.freeQty >= need.quantity;
      });
      const analogTried = candidates.length > 1;
      warnings.push({
        materialId: line.materialId,
        materialName: specMaterial?.name,
        need: fallbackNeed.quantity,
        message:
          triedLots.length === 0 && !analogTried
            ? 'Нет доступных партий'
            : triedLots.length === 0 && analogTried
              ? 'Нет доступных партий (включая аналоги)'
              : anyQty && !anyQty.qualityAllowed
                ? 'Есть остаток, но партия не годна по качеству'
                : 'Нет одной партии с достаточным остатком (GMP: смешивание партий запрещено)',
        candidates: triedLots.slice(0, 5),
      });
      if (fallbackNeed.missing) {
        warnings.push({
          materialId: line.materialId,
          materialName: specMaterial?.name,
          need: fallbackNeed.quantity,
          message: recalcMissingMessage(fallbackNeed.missingCodes),
        });
      }
      for (const msg of missingRequiredMessages(fallback?.id, chosenCand.materialId)) {
        warnings.push({
          materialId: line.materialId,
          materialName: specMaterial?.name,
          need: fallbackNeed.quantity,
          message: msg,
        });
      }
      picks.push(
        pickPayload(line, specMaterial, chosenCand, fallback, fallbackNeed, allowedMaterialIds, false)
      );
    } else {
      if (suitableNeed.missing) {
        warnings.push({
          materialId: line.materialId,
          materialName: specMaterial?.name,
          need: suitableNeed.quantity,
          message: recalcMissingMessage(suitableNeed.missingCodes),
        });
      }
      const lotForReq = suitable;
      for (const msg of missingRequiredMessages(lotForReq?.id, chosenCand.materialId)) {
        warnings.push({
          materialId: line.materialId,
          materialName: specMaterial?.name,
          need: suitableNeed.quantity,
          message: msg,
        });
      }
      picks.push(
        pickPayload(line, specMaterial, chosenCand, suitable, suitableNeed, allowedMaterialIds, true)
      );
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

export function confirmMaterialPicks(orderId, picks, userId) {
  return store.runWrite(() => confirmMaterialPicksUnchecked(orderId, picks, userId));
}

function closeOpenReservationForOrder(orderId, userId) {
  const open = documents
    .listDocuments('reservation', { productionOrderId: orderId })
    .filter((d) => d.status === 'posted' || d.status === 'draft');
  for (const doc of open) {
    documents.cancelDocumentUnchecked('reservation', doc.id, userId);
  }
}

function confirmMaterialPicksUnchecked(orderId, picks, userId) {
  if (!orderId) throw new Error('id required');
  const order = store.getById('production_orders', orderId);
  if (!order) throw new Error('Заказ не найден');
  assertOrderStatus(order, [ORDER_STATUS.new, ORDER_STATUS.planned], 'Подтверждение резерва');
  const actorId = resolveActorUserId(userId);
  const spec = store.getById('specifications', order.specificationId);
  if (!spec) throw new Error('Спецификация не найдена');

  const byMat = new Map();
  const byLine = new Set();
  const normalized = [];
  for (const p of picks) {
    const specLine = findSpecLine(spec, p);
    if (!specLine) throw new Error(`Не найдена строка спецификации для материала ${p.materialId}`);
    if (byLine.has(specLine.id)) {
      throw new Error('GMP: нельзя резервировать две партии на одну позицию спецификации');
    }
    byLine.add(specLine.id);
    const actualMaterialId = p.materialId || specLine.materialId;
    if (!isAllowedSubstitute(specLine.materialId, actualMaterialId, spec.id)) {
      throw new Error('Материал не входит в список аналогов для этой позиции спецификации');
    }
    if (!p.lotId) throw new Error(`Не выбрана партия для материала ${actualMaterialId}`);
    if (byMat.has(actualMaterialId) && byMat.get(actualMaterialId) !== p.lotId) {
      throw new Error('GMP: нельзя резервировать две партии одного материала на одну серию');
    }
    byMat.set(actualMaterialId, p.lotId);
    const free = freeQtyByLot(p.lotId, { excludeProductionOrderId: orderId });
    if (free < Number(p.quantity)) {
      throw new Error(`Недостаточно свободного остатка по партии ${p.lotId}`);
    }
    const lot = store.getById('lots', p.lotId);
    if (!lot || lot.materialId !== actualMaterialId) {
      throw new Error('Партия не соответствует материалу');
    }
    normalized.push({
      specLineId: specLine.id,
      specMaterialId: specLine.materialId,
      materialId: actualMaterialId,
      lotId: p.lotId,
      quantity: Number(p.quantity),
      substitutionRuleId: substitutionRuleId(specLine.materialId, actualMaterialId, spec.id),
    });
  }

  assertLotsQualityForUse(
    normalized.map((p) => p.lotId),
    'Подтверждение резерва'
  );

  closeOpenReservationForOrder(orderId, actorId);

  const whComp = warehouseByType('компоненты')?.id;
  if (!whComp) throw new Error('Не найден склад компонентов');

  const lines = normalized.map((p) => ({
    materialId: p.materialId,
    lotId: p.lotId,
    quantity: Number(p.quantity),
  }));

  const draft = documents.createDocumentUnchecked('reservation', {
    createdByUserId: actorId,
    warehouseId: whComp,
    productionOrderId: orderId,
    seriesId: order.seriesId,
    lines,
    comment: `Резерв по заказу ${orderId}`,
  });
  const posted = documents.postDocumentUnchecked('reservation', draft.id, actorId);

  const orderLines = normalized.map((l) => ({
    specLineId: l.specLineId,
    specMaterialId: l.specMaterialId,
    materialId: l.materialId,
    lotId: l.lotId,
    quantity: l.quantity,
    substitutionRuleId: l.substitutionRuleId,
    reservationDocumentId: posted.id,
  }));

  const updated = store.update('production_orders', orderId, {
    status: ORDER_STATUS.planned,
    lines: orderLines,
    actualQuantity: Number(order.quantity),
    actualLines: orderLines.map((l) => ({
      specLineId: l.specLineId,
      specMaterialId: l.specMaterialId,
      materialId: l.materialId,
      lotId: l.lotId,
      quantity: Number(l.quantity),
      substitutionRuleId: l.substitutionRuleId || null,
    })),
  });

  return { order: updated, reservationDocument: posted };
}

export function confirmMaterialPicksBulk(items, userId) {
  return store.runWrite(() =>
    items.map(({ orderId, picks }) => confirmMaterialPicksUnchecked(orderId, picks, userId))
  );
}

function cryptoRandom() {
  return globalThis.crypto.randomUUID();
}

/** Сохранить факт выпуска и фактический состав (до завершения) */
export function saveProductionFact(orderId, { actualQuantity, actualLines }) {
  return store.runWrite(() => {
    const order = store.getById('production_orders', orderId);
    if (!order) throw new Error('Заказ не найден');
    assertOrderStatus(order, [ORDER_STATUS.planned], 'Сохранение факта');
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
      const spec = store.getById('specifications', order.specificationId);
      const specLine = spec ? findSpecLine(spec, line) : null;
      const specMaterialId = specLine?.materialId || line.specMaterialId || line.materialId;
      if (spec && !isAllowedSubstitute(specMaterialId, line.materialId, spec.id)) {
        throw new Error('Фактический материал не входит в список аналогов для позиции спецификации');
      }
    }
    assertLotsQualityForUse(
      actualLines.map((l) => l.lotId),
      'Сохранение факта'
    );
    return store.update('production_orders', orderId, {
      actualQuantity: Number(actualQuantity),
      actualLines: actualLines.map((l) => ({
        specLineId: l.specLineId || null,
        specMaterialId: l.specMaterialId || l.materialId,
        materialId: l.materialId,
        lotId: l.lotId,
        quantity: Number(l.quantity),
        substitutionRuleId: l.substitutionRuleId || null,
      })),
    });
  });
}

function findPostedDocForOrder(type, orderId) {
  return documents.listDocuments(type, { productionOrderId: orderId }).find((d) => d.status === 'posted');
}

function resolvePostedReservation(order) {
  const orderId = order.id;
  const byOrder = documents.findReservationDocumentForOrder(orderId, ['posted']);
  if (byOrder) return byOrder;
  const fromLine = (order.lines || []).find((l) => l.reservationDocumentId)?.reservationDocumentId;
  if (fromLine) {
    const doc = documents.getDocument('reservation', fromLine);
    if (doc && doc.status === 'posted') return doc;
  }
  return null;
}

function fulfillReservationForOrder(order, priDoc, actorId, fallbackRes) {
  const resDoc = resolvePostedReservation(order) || (fallbackRes?.status === 'posted' ? fallbackRes : null);
  if (!resDoc) {
    throw new Error('Нет проведённого резерва для закрытия при завершении заказа');
  }
  return documents.fulfillDocumentUnchecked('reservation', resDoc.id, actorId, {
    basisDocumentId: priDoc?.id || null,
    basisDocumentNumber: priDoc?.number || null,
  });
}

function ensureGpLot(order, outputQty, whFg, actorUserId) {
  const series = store.getById('series', order.seriesId);
  const gpNumber = `ГП-${series?.number || order.id.slice(0, 8)}`;
  let gpLot = store.readAll('lots').find((l) => l.number === gpNumber);
  if (!gpLot) {
    gpLot = store.create('lots', {
      id: cryptoRandom(),
      number: gpNumber,
      materialId: order.materialId,
      counterpartyId: null,
      manufacturerId: null,
      productionDate: new Date().toISOString().slice(0, 10),
      expiryDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 730).toISOString().slice(0, 10),
    });
    if (actorUserId) onLotCreated(gpLot, actorUserId);
  }
  return { gpLot, outputQty, whFg };
}

export function completeOrder(orderId, userId, opts = {}) {
  return store.runWrite(() => {
    const order = store.getById('production_orders', orderId);
    if (!order) throw new Error('Заказ не найден');
    assertOrderStatus(order, [ORDER_STATUS.planned], 'Завершение производства');
    const actorId = resolveActorUserId(userId);

    const planLines = order.lines || [];
    const factLines =
      Array.isArray(order.actualLines) && order.actualLines.length > 0 ? order.actualLines : planLines;
    const outputQty =
      order.actualQuantity != null && Number(order.actualQuantity) > 0
        ? Number(order.actualQuantity)
        : Number(order.quantity);

    if (!factLines.length) throw new Error('Нет строк состава — завершение невозможно');
    if (!(outputQty > 0)) throw new Error('Количество выпуска должно быть больше 0');

    assertLotsQualityForUse(
      factLines.map((l) => l.lotId),
      'Завершение производства'
    );

    const whCompDefault = warehouseByType('компоненты')?.id;
    const whFgDefault = warehouseByType('ГП')?.id;
    const whComp = opts.warehouseFromId || whCompDefault;
    const whFg = opts.warehouseToId || whFgDefault;
    if (!whComp || !whFg) throw new Error('Не заданы склады компонентов и ГП');
    if (!store.getById('warehouses', whComp)) throw new Error('Склад списания не найден');
    if (!store.getById('warehouses', whFg)) throw new Error('Склад выпуска не найден');

    let resDoc = resolvePostedReservation(order);
    if (!resDoc) {
      const draft = documents.createDocumentUnchecked('reservation', {
        createdByUserId: actorId,
        warehouseId: whComp,
        productionOrderId: orderId,
        seriesId: order.seriesId,
        lines: planLines.map((l) => ({
          materialId: l.materialId,
          lotId: l.lotId,
          quantity: Number(l.quantity),
        })),
        comment: 'RES создан при завершении (не было проведённого резерва)',
      });
      resDoc = documents.postDocumentUnchecked('reservation', draft.id, actorId);
    }

    let priDoc = findPostedDocForOrder('production_issue', orderId);
    if (!priDoc) {
      const draft = documents.createDocumentUnchecked('production_issue', {
        createdByUserId: actorId,
        warehouseFromId: whComp,
        productionOrderId: orderId,
        seriesId: order.seriesId,
        basisDocumentId: resDoc.id,
        lines: factLines.map((l) => ({
          materialId: l.materialId,
          lotId: l.lotId,
          quantity: Number(l.quantity),
        })),
        comment: `Списание в производство по заказу`,
      });
      priDoc = documents.postDocumentUnchecked('production_issue', draft.id, actorId);
    }

    const { gpLot } = ensureGpLot(order, outputQty, whFg, actorId);

    let prrDoc = findPostedDocForOrder('production_receipt', orderId);
    if (!prrDoc) {
      const draft = documents.createDocumentUnchecked('production_receipt', {
        createdByUserId: actorId,
        warehouseToId: whFg,
        productionOrderId: orderId,
        seriesId: order.seriesId,
        basisDocumentId: priDoc.id,
        lines: [
          {
            materialId: order.materialId,
            lotId: gpLot.id,
            quantity: outputQty,
          },
        ],
        comment: `Выпуск ГП по заказу`,
      });
      prrDoc = documents.postDocumentUnchecked('production_receipt', draft.id, actorId);
    }

    const fulfilledRes = fulfillReservationForOrder(order, priDoc, actorId, resDoc);

    const updated = store.update('production_orders', orderId, {
      status: ORDER_STATUS.done,
      lines: planLines,
      actualQuantity: outputQty,
      actualLines: factLines,
    });

    productionRegister.upsertProductionRegister({
      order: updated,
      gpLot,
      outputQty,
      actorId,
      resDoc: fulfilledRes,
      priDoc,
      prrDoc,
      factLines,
    });

    return {
      order: updated,
      documents: {
        reservation: fulfilledRes,
        productionIssue: priDoc,
        productionReceipt: prrDoc,
      },
    };
  });
}

export function getOrderTrace(orderId) {
  return documents.getOrderTrace(orderId);
}

export function cancelOrder(orderId, userId) {
  return store.runWrite(() => {
    const order = store.getById('production_orders', orderId);
    if (!order) throw new Error('Заказ не найден');
    assertOrderStatus(order, [ORDER_STATUS.new, ORDER_STATUS.planned], 'Отмена заказа');
    const actorId = resolveActorUserId(userId);

    if (order.status === ORDER_STATUS.planned) {
      closeOpenReservationForOrder(orderId, actorId);
    }

    return store.update('production_orders', orderId, {
      status: ORDER_STATUS.cancelled,
      lines: order.status === ORDER_STATUS.new ? [] : order.lines || [],
      actualLines: [],
      actualQuantity: null,
    });
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

const ACTIVE_ORDER_STATUSES = [ORDER_STATUS.new, ORDER_STATUS.planned];

function parsePeriodBound(dateStr, endOfDay) {
  const raw = String(dateStr || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new Error('Период: укажите даты в формате ГГГГ-ММ-ДД');
  }
  const d = new Date(`${raw}T${endOfDay ? '23:59:59' : '00:00:00'}`);
  if (Number.isNaN(d.getTime())) throw new Error('Некорректная дата периода');
  return d.toISOString();
}

/** Основная спецификация продукта (при нескольких — первая по имени). */
export function findMainSpecification(materialId) {
  const specs = store
    .readAll('specifications')
    .filter((s) => s.productMaterialId === materialId && (s.type || 'Основная') === 'Основная')
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ru'));
  return specs[0] || null;
}

/**
 * Массовое создание заказов «новый» по уже существующим сериям.
 * body: { startDate, endDate, lines: [{ seriesId, quantity, specificationId?, workCenterId? }] }
 */
export function planSeries(payload = {}) {
  const { startDate, endDate, lines = [] } = payload;
  if (!Array.isArray(lines) || !lines.length) {
    throw new Error('Добавьте хотя бы одну серию');
  }

  const startAt = parsePeriodBound(startDate, false);
  const endAt = parsePeriodBound(endDate, true);
  if (new Date(endAt) < new Date(startAt)) {
    throw new Error('Дата окончания периода раньше даты начала');
  }

  const seenSeries = new Set();
  const prepared = [];

  for (let i = 0; i < lines.length; i += 1) {
    const row = lines[i] || {};
    const seriesId = String(row.seriesId || '').trim();
    const quantity = Number(row.quantity);
    const label = `Строка ${i + 1}`;

    if (!seriesId) throw new Error(`${label}: укажите серию`);
    if (seenSeries.has(seriesId)) throw new Error(`${label}: серия повторяется в плане`);
    seenSeries.add(seriesId);
    if (!(quantity > 0)) throw new Error(`${label}: количество должно быть больше 0`);

    const series = store.getById('series', seriesId);
    if (!series) throw new Error(`${label}: серия не найдена`);

    const open = store
      .readAll('production_orders')
      .find((o) => o.seriesId === seriesId && ACTIVE_ORDER_STATUSES.includes(o.status));
    if (open) {
      throw new Error(
        `${label}: у серии «${series.number}» уже есть незакрытый заказ (статус «${open.status}»). Выберите серию без активного заказа.`
      );
    }

    let spec = null;
    const requestedSpecId = String(row.specificationId || '').trim();
    if (requestedSpecId) {
      spec = store.getById('specifications', requestedSpecId);
      if (!spec || spec.productMaterialId !== series.materialId) {
        throw new Error(`${label}: спецификация не относится к продукту серии «${series.number}»`);
      }
    } else {
      spec = findMainSpecification(series.materialId);
    }
    if (!spec) {
      throw new Error(`${label}: нет спецификации для продукта серии «${series.number}»`);
    }

    let workCenterId = String(row.workCenterId || '').trim();
    if (!workCenterId) {
      if (!spec.techMapId) {
        throw new Error(`${label}: у спецификации «${spec.name}» не указана техкарта`);
      }
      const techMap = store.getById('tech_maps', spec.techMapId);
      if (!techMap?.workCenterId) {
        throw new Error(`${label}: техкарта спецификации «${spec.name}» не найдена или без РЦ`);
      }
      workCenterId = techMap.workCenterId;
    }
    if (!store.getById('work_centers', workCenterId)) {
      throw new Error(`${label}: рабочий центр не найден`);
    }

    prepared.push({
      id: randomUUID(),
      materialId: series.materialId,
      seriesId,
      workCenterId,
      startAt,
      endAt,
      quantity,
      status: ORDER_STATUS.new,
      lines: [],
      actualQuantity: null,
      actualLines: [],
      specificationId: spec.id,
    });
  }

  const created = prepared.map((order) => store.create('production_orders', order));
  return { orders: created, count: created.length };
}
