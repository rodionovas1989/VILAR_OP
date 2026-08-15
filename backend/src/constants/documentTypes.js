/** Типы складских документов: код, коллекция JSON, правила складов */
export const DOCUMENT_TYPES = {
  receipt: {
    code: 'RCP',
    label: 'Приёмка',
    collection: 'receipt_documents',
    warehouseMode: 'to',
    canFulfill: false,
  },
  transfer: {
    code: 'TRN',
    label: 'Перемещение',
    collection: 'transfer_documents',
    warehouseMode: 'both',
    canFulfill: false,
  },
  inventory: {
    code: 'INV',
    label: 'Инвентаризация',
    collection: 'inventory_documents',
    warehouseMode: 'single',
    canFulfill: false,
  },
  writeoff: {
    code: 'WOF',
    label: 'Списание',
    collection: 'writeoff_documents',
    warehouseMode: 'from',
    canFulfill: false,
  },
  posting: {
    code: 'PST',
    label: 'Оприходование',
    collection: 'posting_documents',
    warehouseMode: 'to',
    canFulfill: false,
  },
  reservation: {
    code: 'RES',
    label: 'Резервирование',
    collection: 'reservation_documents',
    warehouseMode: 'single',
    canFulfill: true,
  },
  production_issue: {
    code: 'PRI',
    label: 'Списание в производство',
    collection: 'production_issue_documents',
    warehouseMode: 'from',
    canFulfill: false,
  },
  production_receipt: {
    code: 'PRR',
    label: 'Выпуск из производства',
    collection: 'production_receipt_documents',
    warehouseMode: 'to',
    canFulfill: false,
  },
  shipment: {
    code: 'SHP',
    label: 'Отгрузка',
    collection: 'shipment_documents',
    warehouseMode: 'from',
    canFulfill: false,
  },
};

/** Типы документов управления качеством (изолированная подсистема) */
export const QUALITY_DOCUMENT_TYPES = {
  quality_incoming: {
    code: 'QIN',
    label: 'Поступление на контроль',
  },
  quality_release: {
    code: 'QRL',
    label: 'Допуск к использованию',
  },
  quality_lot_block: {
    code: 'QBL',
    label: 'Блокировка партии',
  },
};

export const DOCUMENT_STATUS = {
  draft: 'Создан',
  posted: 'Проведён',
  cancelled: 'Отменён',
  fulfilled: 'Выполнен',
};

export const QUALITY_DOCUMENT_STATUS = {
  draft: 'Создан',
  posted: 'Проведён',
  cancelled: 'Отменён',
};

export function documentTypeByCode(code) {
  return Object.entries(DOCUMENT_TYPES).find(([, m]) => m.code === code)?.[0] || null;
}

export function assertDocumentType(type) {
  if (!DOCUMENT_TYPES[type]) throw new Error(`Неизвестный тип документа: ${type}`);
  return type;
}

export function collectionForType(type) {
  assertDocumentType(type);
  return DOCUMENT_TYPES[type].collection;
}

export const ALL_DOCUMENT_COLLECTIONS = Object.values(DOCUMENT_TYPES).map((m) => m.collection);

export function assertQualityDocumentType(type) {
  if (!QUALITY_DOCUMENT_TYPES[type]) throw new Error(`Неизвестный тип документа качества: ${type}`);
  return type;
}
