import { ALL_DOCUMENT_COLLECTIONS, DOCUMENT_TYPES } from './documentTypes.js';

/** коллекция API → objectId матрицы прав */
export const COLLECTION_TO_OBJECT = {
  materials: 'materials',
  specifications: 'specifications',
  counterparties: 'counterparties',
  manufacturers: 'manufacturers',
  lots: 'lots',
  series: 'series',
  work_centers: 'work_centers',
  tech_maps: 'tech_maps',
  warehouses: 'warehouses',
  planned_series_volumes: 'planned_series_volumes',
  substitutions: 'substitutions',
  lot_characteristics: 'lot_characteristics',
  production_orders: 'production_orders',
  stock: 'stock',
  active_reservations: 'active_reservations',
  reservation_history: 'reservation_history',
  material_movements: 'material_movements',
  users: 'admin_users',
  roles: 'admin_roles',
  quality_documents: 'quality_documents',
  quality_register: 'quality_register',
  quality_history: 'quality_history',
  lot_qualities: 'lot_qualities',
  quality_scenarios: 'quality_scenarios',
  characteristic_documents: 'characteristic_documents',
  characteristic_register: 'characteristic_register',
  characteristic_history: 'characteristic_history',
  production_register: 'production_register',
  user_favorites: 'admin_users',
  feedback: 'admin_feedback',
};

for (const [type, meta] of Object.entries(DOCUMENT_TYPES)) {
  COLLECTION_TO_OBJECT[meta.collection] = `doc_${type}`;
}

export function objectIdForCollection(collection) {
  return COLLECTION_TO_OBJECT[collection] || null;
}

/** Черновики документов может править роль с create (кладовщик). */
export function writeLevelForCollection(collection) {
  const objectId = objectIdForCollection(collection);
  if (objectId?.startsWith('doc_') || collection === 'quality_documents' || collection === 'characteristic_documents' || collection === 'feedback') {
    return 'create';
  }
  return 'modify';
}

/** Остатки/регистры/документы нельзя править через PUT/POST /api/{collection}. */
export const GENERIC_WRITE_CLOSED = new Set([
  'stock',
  'active_reservations',
  'reservation_history',
  'material_movements',
  'quality_register',
  'quality_history',
  'quality_documents',
  'characteristic_register',
  'characteristic_history',
  'characteristic_documents',
  'production_register',
  'document_sequences',
  'user_favorites',
  'stock_documents',
  'feedback',
  ...ALL_DOCUMENT_COLLECTIONS,
]);

export function isGenericWriteClosed(collection) {
  return GENERIC_WRITE_CLOSED.has(collection);
}
