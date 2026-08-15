import { randomUUID } from 'crypto';
import * as store from '../store.js';
import {
  QUALITY_DOCUMENT_TYPES,
  QUALITY_DOCUMENT_STATUS,
  assertQualityDocumentType,
} from '../constants/documentTypes.js';

function cryptoRandom() {
  return randomUUID();
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function activeBlockOnLot(lotId, excludeDocId) {
  return store
    .readAll('quality_documents')
    .find(
      (d) =>
        d.type === 'quality_lot_block' &&
        d.status === 'posted' &&
        d.lotId === lotId &&
        d.id !== excludeDocId
    );
}

function applyLotBlock(lotId, doc) {
  const lot = store.getById('lots', lotId);
  if (!lot) throw new Error('Партия не найдена');
  store.update('lots', lotId, {
    blocked: true,
    blockReason: String(doc.reason || '').trim(),
    blockDocumentId: doc.id,
  });
}

function clearLotBlockIfNeeded(lotId, cancelledDocId) {
  const lot = store.getById('lots', lotId);
  if (!lot) return;
  const other = activeBlockOnLot(lotId, cancelledDocId);
  if (other) {
    store.update('lots', lotId, {
      blocked: true,
      blockReason: String(other.reason || '').trim(),
      blockDocumentId: other.id,
    });
    return;
  }
  if (lot.blockDocumentId === cancelledDocId || lot.blocked) {
    store.update('lots', lotId, {
      blocked: false,
      blockReason: null,
      blockDocumentId: null,
    });
  }
}

export function nextQualityDocumentNumber(type, dateStr = todayIso()) {
  assertQualityDocumentType(type);
  const code = QUALITY_DOCUMENT_TYPES[type].code;
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
  if (filter.type) rows = rows.filter((d) => d.type === filter.type);
  if (filter.status) rows = rows.filter((d) => d.status === filter.status);
  return rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export function getQualityDocument(id) {
  return store.getById('quality_documents', id);
}

export function createQualityDocument(payload) {
  const type = assertQualityDocumentType(payload.type);
  const userId = payload.createdByUserId;
  if (!userId) throw new Error('Укажите пользователя');
  if (!store.getById('users', userId)) throw new Error('Пользователь не найден');

  const reason = String(payload.reason || '').trim();
  if (type === 'quality_lot_block') {
    if (!payload.lotId) throw new Error('Укажите партию для блокировки');
    if (!reason) throw new Error('Укажите причину блокировки партии');
    if (!store.getById('lots', payload.lotId)) throw new Error('Партия не найдена');
  }

  const lot = payload.lotId ? store.getById('lots', payload.lotId) : null;
  const date = payload.date || todayIso();
  const doc = {
    id: cryptoRandom(),
    type,
    number: nextQualityDocumentNumber(type, date),
    date,
    status: 'draft',
    lotId: payload.lotId || null,
    materialId: payload.materialId || lot?.materialId || null,
    reason: reason || '',
    createdByUserId: userId,
    createdAt: new Date().toISOString(),
    postedAt: null,
    cancelledAt: null,
    comment: payload.comment || '',
    lines: Array.isArray(payload.lines) ? payload.lines : [],
  };
  return store.create('quality_documents', doc);
}

export function updateQualityDocument(id, patch) {
  const current = getQualityDocument(id);
  if (!current) throw new Error('Документ не найден');
  if (current.status !== 'draft') throw new Error('Редактирование только для статуса «Создан»');

  const nextType = current.type;
  const lotId = patch.lotId !== undefined ? patch.lotId : current.lotId;
  const reason =
    patch.reason !== undefined ? String(patch.reason || '').trim() : String(current.reason || '').trim();

  if (nextType === 'quality_lot_block') {
    if (!lotId) throw new Error('Укажите партию для блокировки');
    if (!reason) throw new Error('Укажите причину блокировки партии');
    if (!store.getById('lots', lotId)) throw new Error('Партия не найдена');
  }

  const lot = lotId ? store.getById('lots', lotId) : null;
  return store.update('quality_documents', id, {
    date: patch.date ?? current.date,
    lotId: lotId ?? null,
    materialId: patch.materialId ?? lot?.materialId ?? current.materialId,
    reason,
    comment: patch.comment ?? current.comment,
    lines: patch.lines ?? current.lines,
  });
}

/** Проведение — пишет в регистры качества; QBL также ставит флаг блокировки на партии */
export function postQualityDocument(id, userId) {
  return store.runWrite(() => {
    const doc = getQualityDocument(id);
    if (!doc) throw new Error('Документ не найден');
    if (doc.status !== 'draft') throw new Error('Провести можно только документ «Создан»');

    if (doc.type === 'quality_lot_block') {
      if (!doc.lotId) throw new Error('Укажите партию для блокировки');
      if (!String(doc.reason || '').trim()) throw new Error('Укажите причину блокировки партии');
    }

    const posted = store.update('quality_documents', id, {
      status: 'posted',
      postedAt: new Date().toISOString(),
      postedByUserId: userId,
    });

    if (doc.type === 'quality_lot_block' && doc.lotId) {
      applyLotBlock(doc.lotId, { ...doc, ...posted });
    } else if (doc.lotId) {
      const existing = store.readAll('quality_register').find((r) => r.lotId === doc.lotId);
      const status =
        doc.type === 'quality_release' ? 'released' : doc.type === 'quality_incoming' ? 'quarantine' : 'unknown';
      if (existing) {
        store.update('quality_register', existing.id, {
          status,
          documentId: doc.id,
          documentNumber: doc.number,
          documentStatus: posted.status,
          updatedAt: new Date().toISOString(),
        });
      } else {
        store.create('quality_register', {
          id: cryptoRandom(),
          lotId: doc.lotId,
          materialId: doc.materialId,
          status,
          documentId: doc.id,
          documentNumber: doc.number,
          documentStatus: posted.status,
          updatedAt: new Date().toISOString(),
        });
      }
    }

    store.create('quality_history', {
      id: cryptoRandom(),
      at: new Date().toISOString(),
      action: 'post',
      documentId: doc.id,
      documentNumber: doc.number,
      documentType: doc.type,
      documentStatus: posted.status,
      lotId: doc.lotId,
      materialId: doc.materialId,
      userId,
    });

    return posted;
  });
}

export function cancelQualityDocument(id, userId) {
  return store.runWrite(() => {
    const doc = getQualityDocument(id);
    if (!doc) throw new Error('Документ не найден');
    if (doc.status === 'cancelled') throw new Error('Документ уже отменён');

    const cancelled = store.update('quality_documents', id, {
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
      cancelledByUserId: userId,
    });

    if (doc.type === 'quality_lot_block' && doc.lotId && doc.status === 'posted') {
      clearLotBlockIfNeeded(doc.lotId, doc.id);
    }

    store.create('quality_history', {
      id: cryptoRandom(),
      at: new Date().toISOString(),
      action: 'cancel',
      documentId: doc.id,
      documentNumber: doc.number,
      documentType: doc.type,
      documentStatus: cancelled.status,
      lotId: doc.lotId,
      materialId: doc.materialId,
      userId,
    });

    return cancelled;
  });
}

export { QUALITY_DOCUMENT_TYPES, QUALITY_DOCUMENT_STATUS };
