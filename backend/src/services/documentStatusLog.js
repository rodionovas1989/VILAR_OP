import crypto from 'crypto';
import * as store from '../store.js';

function cryptoRandom() {
  return crypto.randomUUID();
}

/**
 * Append-only journal of document status / save actions (sqlite collection).
 * @param {{
 *   action: string,
 *   documentType: string,
 *   documentId: string,
 *   documentNumber?: string,
 *   fromStatus?: string|null,
 *   toStatus?: string|null,
 *   userId?: string|null,
 *   productionOrderId?: string|null,
 * }} row
 */
export function appendDocumentStatusLog(row) {
  store.create('document_status_log', {
    id: cryptoRandom(),
    at: new Date().toISOString(),
    action: String(row.action || ''),
    documentType: String(row.documentType || ''),
    documentId: String(row.documentId || ''),
    documentNumber: row.documentNumber || '',
    fromStatus: row.fromStatus ?? null,
    toStatus: row.toStatus ?? null,
    userId: row.userId || null,
    productionOrderId: row.productionOrderId || null,
  });
}

/** Newest first. */
export function listDocumentStatusLog({ limit = 300, documentType, userId } = {}) {
  let rows = store.readAll('document_status_log');
  if (documentType) {
    rows = rows.filter((r) => r.documentType === documentType);
  }
  if (userId) {
    rows = rows.filter((r) => r.userId === userId);
  }
  rows.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  return rows.slice(0, Math.max(1, Math.min(Number(limit) || 300, 2000)));
}
