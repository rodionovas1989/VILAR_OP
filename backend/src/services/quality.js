import { randomUUID } from 'crypto';
import * as store from '../store.js';
import {
  QUALITY_DOCUMENT_TYPES,
  QUALITY_DOCUMENT_STATUS,
  QUALITY_MANAGEMENT_TYPE,
  LOT_QUALITY_PERMISSIONS,
  assertQualityDocumentType,
  assertLotQualityPermission,
  labelLotQualityPermission,
} from '../constants/lotQuality.js';

function cryptoRandom() {
  return randomUUID();
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function nowTime() {
  return new Date().toISOString().slice(11, 19);
}

function normalizeLines(lines) {
  if (!Array.isArray(lines) || !lines.length) {
    throw new Error('Укажите хотя бы одну строку: материал, партия и качество');
  }
  const out = [];
  const seenLots = new Set();
  for (const raw of lines) {
    const materialId = raw.materialId || null;
    const lotId = raw.lotId || null;
    const qualityId = raw.qualityId || null;
    if (!materialId || !lotId || !qualityId) {
      throw new Error('В каждой строке укажите материал, партию и качество');
    }
    const lot = store.getById('lots', lotId);
    if (!lot) throw new Error('Партия не найдена');
    if (lot.materialId !== materialId) throw new Error('Партия не соответствует материалу');
    const quality = store.getById('lot_qualities', qualityId);
    if (!quality || quality.active === false) throw new Error('Качество не найдено или неактивно');
    assertLotQualityPermission(quality.permission);
    if (seenLots.has(lotId)) throw new Error('Одна партия не может встречаться в документе дважды');
    seenLots.add(lotId);
    out.push({
      id: raw.id || cryptoRandom(),
      materialId,
      lotId,
      qualityId,
    });
  }
  return out;
}

export function nextQualityDocumentNumber(dateStr = todayIso()) {
  const code = QUALITY_MANAGEMENT_TYPE.code;
  const key = `${code}:${dateStr}`;
  const sequences = store.readAll('document_sequences');
  const row = sequences.find((s) => s.key === key);
  const next = (row?.last ?? 0) + 1;
  if (row) {
    store.update('document_sequences', row.id, { last: next });
  } else {
    store.create('document_sequences', { id: cryptoRandom(), key, last: next });
  }
  return `${code}-${dateStr}-${String(next).padStart(5, '0')}`;
}

export function listQualityDocuments(filter = {}) {
  let rows = store.readAll('quality_documents');
  if (filter.status) rows = rows.filter((d) => d.status === filter.status);
  return rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export function getQualityDocument(id) {
  return store.getById('quality_documents', id);
}

export function createQualityDocument(payload) {
  const type = assertQualityDocumentType(payload.type || QUALITY_MANAGEMENT_TYPE.id);
  const userId = payload.createdByUserId;
  if (!userId) throw new Error('Укажите пользователя');
  if (!store.getById('users', userId)) throw new Error('Пользователь не найден');

  const date = payload.date || todayIso();
  const lines = normalizeLines(payload.lines);
  const doc = {
    id: cryptoRandom(),
    type,
    number: nextQualityDocumentNumber(date),
    date,
    time: payload.time || nowTime(),
    status: 'draft',
    createdByUserId: userId,
    createdAt: new Date().toISOString(),
    postedAt: null,
    cancelledAt: null,
    comment: payload.comment || '',
    lines,
  };
  return store.create('quality_documents', doc);
}

export function updateQualityDocument(id, patch) {
  const current = getQualityDocument(id);
  if (!current) throw new Error('Документ не найден');
  if (current.status !== 'draft') throw new Error('Редактирование только для статуса «Создан»');
  return store.update('quality_documents', id, {
    date: patch.date ?? current.date,
    time: patch.time ?? current.time,
    comment: patch.comment ?? current.comment,
    lines: patch.lines !== undefined ? normalizeLines(patch.lines) : current.lines,
  });
}

function registerRowForLot(lotId) {
  return store.readAll('quality_register').find((r) => r.lotId === lotId) || null;
}

function appendHistory({ action, doc, line, quality, permission, userId }) {
  store.create('quality_history', {
    id: cryptoRandom(),
    at: new Date().toISOString(),
    action,
    documentId: doc.id,
    documentNumber: doc.number,
    documentType: doc.type,
    documentStatus: doc.status,
    lotId: line.lotId,
    materialId: line.materialId,
    qualityId: quality?.id || line.qualityId || null,
    qualityName: quality?.name || null,
    permission,
    permissionLabel: labelLotQualityPermission(permission),
    userId,
  });
}

function applyLineToRegister(doc, line, quality) {
  const permission = assertLotQualityPermission(quality.permission);
  const existing = registerRowForLot(line.lotId);
  const patch = {
    lotId: line.lotId,
    materialId: line.materialId,
    qualityId: quality.id,
    qualityName: quality.name,
    permission,
    permissionLabel: labelLotQualityPermission(permission),
    documentId: doc.id,
    documentNumber: doc.number,
    documentStatus: 'posted',
    updatedAt: new Date().toISOString(),
  };
  if (existing) {
    store.update('quality_register', existing.id, patch);
  } else {
    store.create('quality_register', { id: cryptoRandom(), ...patch });
  }
  // legacy lot flags cleanup
  const lot = store.getById('lots', line.lotId);
  if (lot && (lot.blocked || lot.blockReason || lot.blockDocumentId)) {
    store.update('lots', line.lotId, {
      blocked: false,
      blockReason: null,
      blockDocumentId: null,
    });
  }
}

function restoreRegisterAfterCancel(lotId, cancelledDocId) {
  const current = registerRowForLot(lotId);
  if (!current || current.documentId !== cancelledDocId) return;

  const prev = store
    .readAll('quality_history')
    .filter((h) => h.lotId === lotId && h.action === 'post' && h.documentId !== cancelledDocId)
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))[0];

  if (!prev) {
    store.removeMany('quality_register', [current.id]);
    return;
  }

  store.update('quality_register', current.id, {
    qualityId: prev.qualityId,
    qualityName: prev.qualityName,
    permission: prev.permission,
    permissionLabel: prev.permissionLabel || labelLotQualityPermission(prev.permission),
    documentId: prev.documentId,
    documentNumber: prev.documentNumber,
    documentStatus: 'posted',
    materialId: prev.materialId || current.materialId,
    updatedAt: new Date().toISOString(),
  });
}

export function postQualityDocument(id, userId) {
  return store.runWrite(() => {
    const doc = getQualityDocument(id);
    if (!doc) throw new Error('Документ не найден');
    if (doc.status !== 'draft') throw new Error('Провести можно только документ «Создан»');
    const lines = normalizeLines(doc.lines);

    const posted = store.update('quality_documents', id, {
      status: 'posted',
      postedAt: new Date().toISOString(),
      postedByUserId: userId,
      lines,
    });

    for (const line of lines) {
      const quality = store.getById('lot_qualities', line.qualityId);
      applyLineToRegister(posted, line, quality);
      appendHistory({
        action: 'post',
        doc: posted,
        line,
        quality,
        permission: quality.permission,
        userId,
      });
    }

    return posted;
  });
}

export function cancelQualityDocument(id, userId) {
  return store.runWrite(() => {
    const doc = getQualityDocument(id);
    if (!doc) throw new Error('Документ не найден');
    if (doc.status === 'cancelled') throw new Error('Документ уже отменён');
    const wasPosted = doc.status === 'posted';

    const cancelled = store.update('quality_documents', id, {
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
      cancelledByUserId: userId,
    });

    for (const line of doc.lines || []) {
      const quality = line.qualityId ? store.getById('lot_qualities', line.qualityId) : null;
      const permission = quality?.permission || registerRowForLot(line.lotId)?.permission || 'fit';
      appendHistory({
        action: 'cancel',
        doc: cancelled,
        line,
        quality,
        permission,
        userId,
      });
      if (wasPosted) restoreRegisterAfterCancel(line.lotId, doc.id);
    }

    return cancelled;
  });
}

/**
 * Текущее качество партии для планирования / производства.
 * Нет записи в регистре → по умолчанию Годен.
 */
export function resolveLotQuality(lotId) {
  if (!lotId) {
    return {
      permission: 'fit',
      permissionLabel: labelLotQualityPermission('fit'),
      qualityId: null,
      qualityName: null,
      defaulted: true,
      message: null,
      allowed: true,
    };
  }
  const row = registerRowForLot(lotId);
  if (!row) {
    return {
      permission: 'fit',
      permissionLabel: labelLotQualityPermission('fit'),
      qualityId: null,
      qualityName: null,
      defaulted: true,
      message: null,
      allowed: true,
    };
  }
  const permission = LOT_QUALITY_PERMISSIONS[row.permission] ? row.permission : 'fit';
  const qualityName = row.qualityName || store.getById('lot_qualities', row.qualityId)?.name || null;
  const permissionLabel = row.permissionLabel || labelLotQualityPermission(permission);
  if (permission === 'unfit') {
    return {
      permission,
      permissionLabel,
      qualityId: row.qualityId,
      qualityName,
      defaulted: false,
      message: `Партия не годна по качеству: «${qualityName || permissionLabel}»`,
      allowed: false,
    };
  }
  if (permission === 'conditional') {
    return {
      permission,
      permissionLabel,
      qualityId: row.qualityId,
      qualityName,
      defaulted: false,
      message: `Условно годен: «${qualityName || permissionLabel}»`,
      allowed: true,
    };
  }
  return {
    permission: 'fit',
    permissionLabel: labelLotQualityPermission('fit'),
    qualityId: row.qualityId,
    qualityName,
    defaulted: false,
    message: null,
    allowed: true,
  };
}

/** Запрет операции при «Не годен». Условно годен — только предупреждения. */
export function assertLotsQualityForUse(lotIds, contextLabel = 'Операция') {
  const warnings = [];
  for (const lotId of lotIds) {
    if (!lotId) continue;
    const q = resolveLotQuality(lotId);
    const lot = store.getById('lots', lotId);
    const lotLabel = lot?.number || lotId;
    if (!q.allowed) {
      throw new Error(`${contextLabel}: партия ${lotLabel} — ${q.message || 'Не годен'}`);
    }
    if (q.permission === 'conditional' && q.message) {
      warnings.push(`Партия ${lotLabel}: ${q.message}`);
    }
  }
  return warnings;
}

/** Движения качества и текущее состояние партий по строкам документа — как related у складских */
export function getQualityDocumentTrace(id) {
  const doc = getQualityDocument(id);
  if (!doc) return null;

  const qualityHistory = store
    .readAll('quality_history')
    .filter((h) => h.documentId === id || h.documentNumber === doc.number)
    .sort((a, b) => String(b.at).localeCompare(String(a.at)));

  const lotIds = [...new Set((doc.lines || []).map((l) => l.lotId).filter(Boolean))];
  const qualityRegister = store
    .readAll('quality_register')
    .filter((r) => lotIds.includes(r.lotId))
    .sort((a, b) => String(a.lotId).localeCompare(String(b.lotId)));

  return {
    document: {
      id: doc.id,
      type: doc.type,
      number: doc.number,
      status: doc.status,
      date: doc.date,
    },
    movements: [],
    reservationHistory: [],
    activeReservations: [],
    relatedDocuments: [],
    productionOrder: null,
    stock: [],
    qualityHistory,
    qualityRegister,
  };
}

export { QUALITY_DOCUMENT_TYPES, QUALITY_DOCUMENT_STATUS, LOT_QUALITY_PERMISSIONS, QUALITY_MANAGEMENT_TYPE };
