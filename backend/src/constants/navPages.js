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
  'lots',
  'series',
  'work_centers',
  'warehouses',
  'planned_series_volumes',
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
  'production_orders',
  'planning_desktop',
  'production_desktop',
  'quality_documents',
  'lot_qualities',
  'quality_register',
  'quality_history',
  'report_released_series',
  'report_stock',
  'admin_feedback',
  'admin_user_guide',
  'admin_data_maintenance',
  'admin_login_audit',
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
