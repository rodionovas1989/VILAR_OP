import { randomUUID } from 'crypto';
import * as store from '../store.js';
import * as documents from './documents.js';
import {
  warehouseByType,
  stockRowForLot,
  freeQtyByLot,
  warehousesWithFreeQty,
  preferWarehouseForNeed,
} from './stock.js';
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

export { warehouseByType, stockRowForLot, freeQtyByLot, warehousesWithFreeQty, preferWarehouseForNeed };

const ORDER_STATUS = {
  new: 'новый',
  planned: 'спланирован',
  done: 'завершен',
  cancelled: 'отменен',
};

function groupByWarehouseId(rows) {
  const map = new Map();
  for (const row of rows) {
    const wh = row.warehouseId;
    if (!wh) throw new Error('У строки состава не указан склад');
    if (!map.has(wh)) map.set(wh, []);
    map.get(wh).push(row);
  }
  return map;
}

function requireWarehouseId(warehouseId, label = 'Склад') {
  if (!warehouseId) throw new Error(`${label}: не указан`);
  if (!store.getById('warehouses', warehouseId)) throw new Error(`${label} не найден`);
  return warehouseId;
}

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

/**
 * Доступные партии материала по складам: одна запись на пару (партия, склад)
 * с положительным свободным остатком на этом складе.
 */
export function availableLotsForMaterial(materialId, algorithm = 'FEFO', opts = {}) {
  const filterWh = opts.warehouseId || null;
  const excludeOrderId = opts.excludeProductionOrderId || null;
  const rows = [];

  for (const lot of store.readAll('lots').filter((l) => l.materialId === materialId)) {
    if (new Date(lot.expiryDate) < new Date()) continue;
    const quality = resolveLotQuality(lot.id);
    const whAvail = warehousesWithFreeQty(lot.id, { excludeProductionOrderId: excludeOrderId }).filter(
      (w) => !filterWh || w.warehouseId === filterWh
    );
    for (const wh of whAvail) {
      rows.push({
        ...lot,
        warehouseId: wh.warehouseId,
        warehouseName: wh.warehouseName,
        warehouseType: wh.warehouseType,
        freeQty: wh.freeQty,
        counterparty: lot.counterpartyId ? store.getById('counterparties', lot.counterpartyId) : null,
        manufacturer: lot.manufacturerId ? store.getById('manufacturers', lot.manufacturerId) : null,
        qualityPermission: quality.permission,
        qualityPermissionLabel: quality.permissionLabel,
        qualityName: quality.qualityName,
        qualityMessage: quality.message,
        qualityAllowed: quality.allowed,
        qualityDefaulted: quality.defaulted,
        characteristicValues: getLotCharacteristicMap(lot.id),
      });
    }
  }

  rows.sort((a, b) => {
    if (algorithm === 'FIFO') {
      const d = new Date(a.productionDate) - new Date(b.productionDate);
      if (d !== 0) return d;
    } else {
      const d = new Date(a.expiryDate) - new Date(b.expiryDate);
      if (d !== 0) return d;
    }
    const comp = warehouseByType('компоненты')?.id;
    if (comp) {
      if (a.warehouseId === comp && b.warehouseId !== comp) return -1;
      if (b.warehouseId === comp && a.warehouseId !== comp) return 1;
    }
    return String(a.warehouseName || '').localeCompare(String(b.warehouseName || ''), 'ru');
  });
  return rows;
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
    warehouseId: lot?.warehouseId || null,
    warehouseName: lot?.warehouseName || null,
    warehouseType: lot?.warehouseType || null,
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

function claimKey(lotId, warehouseId) {
  return `${lotId}::${warehouseId || ''}`;
}

function effectiveFreeQty(lot, claimed) {
  const base = Number(lot?.freeQty || 0);
  if (!claimed || !lot?.id) return base;
  const used = Number(claimed.get(claimKey(lot.id, lot.warehouseId)) || 0);
  return base - used;
}

function claimLotQty(claimed, lot, quantity) {
  if (!claimed || !lot?.id || !(quantity > 0)) return;
  const key = claimKey(lot.id, lot.warehouseId);
  claimed.set(key, Number(claimed.get(key) || 0) + Number(quantity));
}

/**
 * GMP: одна партия на один компонент в рамках серии/заказа.
 * Не дробим потребность по нескольким партиям.
 * Если по материалу спеки нет партии — пробуем аналоги (без транзитивности).
 * @param {{ claimed?: Map<string, number> }} [opts] — общий «виртуальный» расход по ключу lotId::warehouseId (пакетный подбор).
 */
export function suggestPicksForOrder(orderId, algorithm = 'FEFO', opts = {}) {
  const order = store.getById('production_orders', orderId);
  if (!order) throw new Error('Заказ не найден');
  const spec = store.getById('specifications', order.specificationId);
  if (!spec) throw new Error('Спецификация не найдена');
  const claimed = opts.claimed || null;

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
        return effectiveFreeQty(l, claimed) >= need.quantity && l.qualityAllowed !== false;
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
        return effectiveFreeQty(l, claimed) >= need.quantity;
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
      claimLotQty(claimed, suitable, suitableNeed.quantity);
      picks.push(
        pickPayload(line, specMaterial, chosenCand, suitable, suitableNeed, allowedMaterialIds, true)
      );
    }
  }

  return { orderId, algorithm, picks, warnings };
}

/**
 * Пакетный подбор: заказы в порядке orderIds делят один виртуальный остаток партия×склад,
 * поэтому второй заказ получает следующую FEFO/FIFO-партию, а не ту же с ✗.
 */
export function suggestPicksBulk(orderIds, algorithm = 'FEFO') {
  const claimed = new Map();
  return (orderIds || []).map((orderId) => suggestPicksForOrder(orderId, algorithm, { claimed }));
}

/**
 * «Хвосты» партий для выбранных заказов: свободный остаток > 0, но меньше потребности
 * хотя бы одной строки подбора по этому материалу, и партия×склад нигде не выбрана.
 * Без авто-утилизации — только обзор (см. wiki/analyses/lot-leftover-tails.md).
 */
export function leftoverLotTails(orderIds, algorithm = 'FEFO') {
  const ids = orderIds || [];
  if (!ids.length) return { algorithm, items: [] };

  const suggestions = suggestPicksBulk(ids, algorithm);
  const selected = new Set();
  /** @type {Map<string, { materialId: string, materialName: string, maxNeed: number, minNeed: number }>} */
  const byMaterial = new Map();

  for (const s of suggestions) {
    for (const p of s.picks || []) {
      const materialId = p.materialId || p.specMaterialId;
      if (!materialId) continue;
      const need = Number(p.quantity) || 0;
      const prev = byMaterial.get(materialId);
      if (!prev) {
        byMaterial.set(materialId, {
          materialId,
          materialName: p.materialName || p.specMaterialName || materialId,
          maxNeed: need,
          minNeed: need,
        });
      } else {
        prev.maxNeed = Math.max(prev.maxNeed, need);
        prev.minNeed = Math.min(prev.minNeed, need);
      }
      if (p.lotId) selected.add(claimKey(p.lotId, p.warehouseId));
    }
  }

  const items = [];
  for (const info of byMaterial.values()) {
    if (!(info.maxNeed > 0)) continue;
    const lots = availableLotsForMaterial(info.materialId, algorithm);
    for (const lot of lots) {
      const free = Number(lot.freeQty) || 0;
      if (!(free > 0)) continue;
      if (free >= info.maxNeed) continue;
      const key = claimKey(lot.id, lot.warehouseId);
      if (selected.has(key)) continue;
      items.push({
        materialId: info.materialId,
        materialName: info.materialName,
        lotId: lot.id,
        lotNumber: lot.number,
        warehouseId: lot.warehouseId || null,
        warehouseName: lot.warehouseName || null,
        warehouseType: lot.warehouseType || null,
        freeQty: free,
        maxNeed: info.maxNeed,
        minNeed: info.minNeed,
        expiryDate: lot.expiryDate || null,
        hint:
          free < info.minNeed
            ? 'Не набирает ни одну серию в выборке — TRN / утилизация / меньшая серия'
            : 'Не набирает крупнейшую серию в выборке — проверить объём серии или TRN',
      });
    }
  }

  items.sort((a, b) => {
    const byMat = String(a.materialName || '').localeCompare(String(b.materialName || ''), 'ru');
    if (byMat !== 0) return byMat;
    return Number(a.freeQty) - Number(b.freeQty);
  });

  return { algorithm, items };
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

    let warehouseId = p.warehouseId || null;
    if (!warehouseId) {
      const preferred = preferWarehouseForNeed(p.lotId, p.quantity, {
        excludeProductionOrderId: orderId,
      });
      warehouseId = preferred?.warehouseId || null;
    }
    requireWarehouseId(warehouseId, 'Склад резерва');

    const free = freeQtyByLot(p.lotId, {
      warehouseId,
      excludeProductionOrderId: orderId,
    });
    if (free < Number(p.quantity)) {
      throw new Error(
        `Недостаточно свободного остатка по партии ${p.lotId} на складе ${warehouseId}`
      );
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
      warehouseId,
      quantity: Number(p.quantity),
      substitutionRuleId: substitutionRuleId(specLine.materialId, actualMaterialId, spec.id),
    });
  }

  assertLotsQualityForUse(
    normalized.map((p) => p.lotId),
    'Подтверждение резерва'
  );

  closeOpenReservationForOrder(orderId, actorId);

  const byWh = groupByWarehouseId(normalized);
  const reservationDocuments = [];
  const resIdByWarehouse = new Map();

  for (const [warehouseId, group] of byWh) {
    const draft = documents.createDocumentUnchecked('reservation', {
      createdByUserId: actorId,
      warehouseId,
      productionOrderId: orderId,
      seriesId: order.seriesId,
      lines: group.map((p) => ({
        materialId: p.materialId,
        lotId: p.lotId,
        quantity: Number(p.quantity),
      })),
      comment: `Резерв по заказу ${orderId}`,
    });
    const posted = documents.postDocumentUnchecked('reservation', draft.id, actorId);
    reservationDocuments.push(posted);
    resIdByWarehouse.set(warehouseId, posted.id);
  }

  const orderLines = normalized.map((l) => ({
    specLineId: l.specLineId,
    specMaterialId: l.specMaterialId,
    materialId: l.materialId,
    lotId: l.lotId,
    warehouseId: l.warehouseId,
    quantity: l.quantity,
    substitutionRuleId: l.substitutionRuleId,
    reservationDocumentId: resIdByWarehouse.get(l.warehouseId),
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
      warehouseId: l.warehouseId,
      quantity: Number(l.quantity),
      substitutionRuleId: l.substitutionRuleId || null,
    })),
  });

  return {
    order: updated,
    reservationDocuments,
    reservationDocument: reservationDocuments[0] || null,
  };
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
    const normalized = [];
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
      let warehouseId = line.warehouseId || null;
      if (!warehouseId) {
        const planLine = (order.lines || []).find(
          (pl) =>
            (line.specLineId && pl.specLineId === line.specLineId) ||
            (pl.materialId === line.materialId && pl.lotId === line.lotId)
        );
        warehouseId = planLine?.warehouseId || null;
      }
      if (!warehouseId) {
        const preferred = preferWarehouseForNeed(line.lotId, line.quantity, {
          excludeProductionOrderId: orderId,
        });
        warehouseId = preferred?.warehouseId || null;
      }
      requireWarehouseId(warehouseId, 'Склад списания в факте');
      normalized.push({
        specLineId: line.specLineId || specLine?.id || null,
        specMaterialId,
        materialId: line.materialId,
        lotId: line.lotId,
        warehouseId,
        quantity: Number(line.quantity),
        substitutionRuleId: line.substitutionRuleId || null,
      });
    }
    assertLotsQualityForUse(
      normalized.map((l) => l.lotId),
      'Сохранение факта'
    );
    return store.update('production_orders', orderId, {
      actualQuantity: Number(actualQuantity),
      actualLines: normalized,
    });
  });
}

function findPostedDocsForOrder(type, orderId) {
  return documents.listDocuments(type, { productionOrderId: orderId }).filter((d) => d.status === 'posted');
}

function findPostedDocForOrder(type, orderId) {
  return findPostedDocsForOrder(type, orderId)[0] || null;
}

function findPostedPriForWarehouse(orderId, warehouseFromId) {
  return findPostedDocsForOrder('production_issue', orderId).find(
    (d) => d.warehouseFromId === warehouseFromId
  );
}

function listPostedReservationsForOrder(order) {
  const orderId = order.id;
  const byOrder = documents
    .listDocuments('reservation', { productionOrderId: orderId })
    .filter((d) => d.status === 'posted');
  if (byOrder.length) return byOrder;
  const ids = [
    ...new Set((order.lines || []).map((l) => l.reservationDocumentId).filter(Boolean)),
  ];
  const fromLines = [];
  for (const id of ids) {
    const doc = documents.getDocument('reservation', id);
    if (doc && doc.status === 'posted') fromLines.push(doc);
  }
  return fromLines;
}

function fulfillAllReservationsForOrder(order, priDocs, actorId) {
  const resDocs = listPostedReservationsForOrder(order);
  if (!resDocs.length) {
    throw new Error('Нет проведённого резерва для закрытия при завершении заказа');
  }
  const priByWh = new Map((priDocs || []).map((p) => [p.warehouseFromId, p]));
  return resDocs.map((resDoc) => {
    const pri = priByWh.get(resDoc.warehouseId) || priDocs?.[0] || null;
    return documents.fulfillDocumentUnchecked('reservation', resDoc.id, actorId, {
      basisDocumentId: pri?.id || null,
      basisDocumentNumber: pri?.number || null,
    });
  });
}

function normalizeFactLinesWithWarehouse(order, factLines) {
  return factLines.map((line) => {
    let warehouseId = line.warehouseId || null;
    if (!warehouseId) {
      const planLine = (order.lines || []).find(
        (pl) =>
          (line.specLineId && pl.specLineId === line.specLineId) ||
          (pl.materialId === line.materialId && pl.lotId === line.lotId)
      );
      warehouseId = planLine?.warehouseId || null;
    }
    if (!warehouseId) {
      const preferred = preferWarehouseForNeed(line.lotId, line.quantity, {
        excludeProductionOrderId: order.id,
      });
      warehouseId = preferred?.warehouseId || null;
    }
    requireWarehouseId(warehouseId, 'Склад списания');
    return {
      ...line,
      warehouseId,
      quantity: Number(line.quantity),
    };
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
    const rawFact =
      Array.isArray(order.actualLines) && order.actualLines.length > 0 ? order.actualLines : planLines;
    const factLines = normalizeFactLinesWithWarehouse(order, rawFact);
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

    const whFgDefault = warehouseByType('ГП')?.id;
    const whFg = opts.warehouseToId || whFgDefault;
    requireWarehouseId(whFg, 'Склад выпуска');

    let reservationDocuments = listPostedReservationsForOrder(order);
    if (!reservationDocuments.length) {
      const byWh = groupByWarehouseId(
        normalizeFactLinesWithWarehouse(order, planLines.length ? planLines : factLines)
      );
      reservationDocuments = [];
      for (const [warehouseId, group] of byWh) {
        const draft = documents.createDocumentUnchecked('reservation', {
          createdByUserId: actorId,
          warehouseId,
          productionOrderId: orderId,
          seriesId: order.seriesId,
          lines: group.map((l) => ({
            materialId: l.materialId,
            lotId: l.lotId,
            quantity: Number(l.quantity),
          })),
          comment: 'RES создан при завершении (не было проведённого резерва)',
        });
        reservationDocuments.push(documents.postDocumentUnchecked('reservation', draft.id, actorId));
      }
    }

    const resByWh = new Map(reservationDocuments.map((d) => [d.warehouseId, d]));
    const factByWh = groupByWarehouseId(factLines);
    const productionIssues = [];

    for (const [warehouseFromId, group] of factByWh) {
      let priDoc = findPostedPriForWarehouse(orderId, warehouseFromId);
      if (!priDoc) {
        const basis = resByWh.get(warehouseFromId) || reservationDocuments[0];
        const draft = documents.createDocumentUnchecked('production_issue', {
          createdByUserId: actorId,
          warehouseFromId,
          productionOrderId: orderId,
          seriesId: order.seriesId,
          basisDocumentId: basis?.id || null,
          lines: group.map((l) => ({
            materialId: l.materialId,
            lotId: l.lotId,
            quantity: Number(l.quantity),
          })),
          comment: `Списание в производство по заказу`,
        });
        priDoc = documents.postDocumentUnchecked('production_issue', draft.id, actorId);
      }
      productionIssues.push(priDoc);
    }

    const { gpLot } = ensureGpLot(order, outputQty, whFg, actorId);

    let prrDoc = findPostedDocForOrder('production_receipt', orderId);
    if (!prrDoc) {
      const draft = documents.createDocumentUnchecked('production_receipt', {
        createdByUserId: actorId,
        warehouseToId: whFg,
        productionOrderId: orderId,
        seriesId: order.seriesId,
        basisDocumentId: productionIssues[0]?.id || null,
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

    const fulfilledReservations = fulfillAllReservationsForOrder(order, productionIssues, actorId);

    const updated = store.update('production_orders', orderId, {
      status: ORDER_STATUS.done,
      lines: planLines,
      actualQuantity: outputQty,
      actualLines: factLines,
    });

    return {
      order: updated,
      documents: {
        reservation: fulfilledReservations[0] || null,
        reservations: fulfilledReservations,
        productionIssue: productionIssues[0] || null,
        productionIssues,
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
