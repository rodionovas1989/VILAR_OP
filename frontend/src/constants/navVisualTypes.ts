/** Пиктотип объекта в меню / заголовке (ортогонально группе NavKind). */
export type NavVisualType =
  | 'dictionary'
  | 'register_state'
  | 'register_history'
  | 'desktop'
  | 'document'
  | 'report'
  | 'admin'
  | 'other';

export const NAV_VISUAL_TYPE_LABEL: Record<NavVisualType, string> = {
  dictionary: 'Справочник',
  register_state: 'Регистр (состояние)',
  register_history: 'Регистр (история)',
  desktop: 'Рабочий стол',
  document: 'Документ',
  report: 'Отчёт',
  admin: 'Администрирование',
  other: 'Раздел',
};

/** Явный маппинг pageId → пиктотип (не эвристика по имени). */
export const PAGE_VISUAL_TYPE: Record<string, NavVisualType> = {
  materials: 'dictionary',
  specifications: 'dictionary',
  counterparties: 'dictionary',
  manufacturers: 'dictionary',
  lots: 'dictionary',
  series: 'dictionary',
  work_centers: 'dictionary',
  tech_maps: 'dictionary',
  warehouses: 'dictionary',
  planned_series_volumes: 'dictionary',
  substitutions: 'dictionary',
  lot_qualities: 'dictionary',
  lot_characteristics: 'dictionary',

  doc_receipt: 'document',
  doc_transfer: 'document',
  doc_inventory: 'document',
  doc_writeoff: 'document',
  doc_posting: 'document',
  doc_reservation: 'document',
  doc_production_issue: 'document',
  doc_production_receipt: 'document',
  doc_shipment: 'document',
  quality_documents: 'document',
  characteristic_documents: 'document',

  stock: 'register_state',
  active_reservations: 'register_state',
  quality_register: 'register_state',
  characteristic_register: 'register_state',

  material_movements: 'register_history',
  reservation_history: 'register_history',
  quality_history: 'register_history',
  characteristic_history: 'register_history',
  production_register: 'register_history',

  planning_desktop: 'desktop',
  production_desktop: 'desktop',
  quality_desktop: 'desktop',

  production_orders: 'other',
  series_planning: 'other',
  quality_scenarios: 'other',

  report_released_series: 'report',
  report_plan_fact: 'report',
  report_stock: 'report',
  report_quality_stock: 'report',
  report_quality_history: 'report',

  admin_user_guide: 'admin',
  admin_legal: 'admin',
  users: 'admin',
  roles: 'admin',
  admin_export_dictionaries: 'admin',
  admin_data_maintenance: 'admin',
  admin_login_audit: 'admin',
  admin_document_status_log: 'admin',
  admin_ops_debug_log: 'admin',
  admin_changelog: 'admin',
  admin_feedback: 'admin',
};

export function visualTypeForPage(pageId: string): NavVisualType {
  return PAGE_VISUAL_TYPE[pageId] || 'other';
}
