import { PermissionMap } from '../constants/systemObjects';
import { canViewObject } from './permissions';

/** ID объекта RBAC для пункта навигации / страницы */
export function pagePermissionId(pageId: string): string {
  if (pageId.startsWith('doc_')) return pageId;
  switch (pageId) {
    case 'users':
      return 'admin_users';
    case 'roles':
      return 'admin_roles';
    case 'admin_export_dictionaries':
      return 'admin_export';
    case 'admin_data_maintenance':
      return 'admin_data_maintenance';
    case 'admin_login_audit':
      return 'admin_login_audit';
    case 'admin_changelog':
      return 'admin_changelog';
    case 'admin_feedback':
      return 'admin_feedback';
    case 'admin_user_guide':
      return 'admin_user_guide';
    case 'admin_legal':
      return 'admin_legal';
    default:
      return pageId;
  }
}

export type NavGroup = { id: string; label: string; items: { id: string; label: string }[] };

export function filterNavByPermissions(
  nav: NavGroup[],
  permissions: PermissionMap | undefined,
  loggedIn: boolean
): NavGroup[] {
  return nav
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        canViewObject(permissions, pagePermissionId(item.id), loggedIn)
      ),
    }))
    .filter((group) => group.items.length > 0);
}

export function canAccessPage(
  pageId: string,
  permissions: PermissionMap | undefined,
  loggedIn: boolean
): boolean {
  if (!loggedIn) return false;
  if (pageId === 'home') return true;
  return canViewObject(permissions, pagePermissionId(pageId), loggedIn);
}
