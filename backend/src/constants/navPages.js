/** pageId навигации → objectId RBAC (зеркало frontend navAccess.ts) */
import { resolveUserPermissions } from '../services/permissions.js';

const PAGE_TO_OBJECT = {
  users: 'admin_users',
  roles: 'admin_roles',
  admin_export_dictionaries: 'admin_export',
  admin_data_maintenance: 'admin_data_maintenance',
  admin_login_audit: 'admin_login_audit',
};

export const NAV_PAGE_IDS = new Set([
  'materials',
  'specifications',
  'counterparties',
  'manufacturers',
  'lots',
  'series',
  'work_centers',
  'tech_maps',
  'warehouses',
  'planned_series_volumes',
  'substitutions',
  'lot_characteristics',
  'doc_receipt',
  'doc_transfer',
  'doc_inventory',
  'doc_writeoff',
  'doc_posting',
  'doc_reservation',
  'doc_production_issue',
  'doc_production_receipt',
  'doc_shipment',
  'stock',
  'active_reservations',
  'reservation_history',
  'material_movements',
  'production_register',
  'production_orders',
  'series_planning',
  'planning_desktop',
  'production_desktop',
  'quality_documents',
  'lot_qualities',
  'quality_register',
  'quality_history',
  'quality_scenarios',
  'characteristic_documents',
  'characteristic_register',
  'characteristic_history',
  'report_released_series',
  'report_plan_fact',
  'report_stock',
  'report_quality_stock',
  'report_quality_history',
  'admin_feedback',
  'admin_user_guide',
  'admin_legal',
  'admin_changelog',
  'admin_data_maintenance',
  'admin_login_audit',
  'admin_document_status_log',
  'admin_ops_debug_log',
  'users',
  'roles',
  'admin_export_dictionaries',
]);

export function pagePermissionId(pageId) {
  if (pageId.startsWith('doc_')) return pageId;
  return PAGE_TO_OBJECT[pageId] || pageId;
}

export function isFavoritePageId(pageId) {
  return NAV_PAGE_IDS.has(pageId);
}

export function canUserAccessPage(user, pageId) {
  if (!user || !isFavoritePageId(pageId)) return false;
  const permissions = resolveUserPermissions(user);
  const objectId = pagePermissionId(pageId);
  return permissions[objectId]?.read === true;
}
