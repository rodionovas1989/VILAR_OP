import { DocumentTypeMeta, StockDocumentType } from '../types.documents';

/** Зеркало backend/src/constants/documentTypes.js — fallback, если meta API ещё не ответил */
export const DOCUMENT_TYPE_META: Record<StockDocumentType, DocumentTypeMeta> = {
  receipt: {
    id: 'receipt',
    code: 'RCP',
    label: 'Приёмка',
    collection: 'receipt_documents',
    warehouseMode: 'to',
    canFulfill: false,
  },
  transfer: {
    id: 'transfer',
    code: 'TRN',
    label: 'Перемещение',
    collection: 'transfer_documents',
    warehouseMode: 'both',
    canFulfill: false,
  },
  inventory: {
    id: 'inventory',
    code: 'INV',
    label: 'Инвентаризация',
    collection: 'inventory_documents',
    warehouseMode: 'single',
    canFulfill: false,
  },
  writeoff: {
    id: 'writeoff',
    code: 'WOF',
    label: 'Списание',
    collection: 'writeoff_documents',
    warehouseMode: 'from',
    canFulfill: false,
  },
  posting: {
    id: 'posting',
    code: 'PST',
    label: 'Оприходование',
    collection: 'posting_documents',
    warehouseMode: 'to',
    canFulfill: false,
  },
  reservation: {
    id: 'reservation',
    code: 'RES',
    label: 'Резервирование',
    collection: 'reservation_documents',
    warehouseMode: 'single',
    canFulfill: true,
  },
  production_issue: {
    id: 'production_issue',
    code: 'PRI',
    label: 'Списание в производство',
    collection: 'production_issue_documents',
    warehouseMode: 'from',
    canFulfill: false,
  },
  production_receipt: {
    id: 'production_receipt',
    code: 'PRR',
    label: 'Выпуск из производства',
    collection: 'production_receipt_documents',
    warehouseMode: 'to',
    canFulfill: false,
  },
  shipment: {
    id: 'shipment',
    code: 'SHP',
    label: 'Отгрузка',
    collection: 'shipment_documents',
    warehouseMode: 'from',
    canFulfill: false,
  },
};

export function metaForDocumentType(type: StockDocumentType): DocumentTypeMeta {
  return DOCUMENT_TYPE_META[type];
}
