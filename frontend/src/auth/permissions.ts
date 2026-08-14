import { PermissionMap } from '../constants/systemObjects';

export type ObjectAccessLevel = 'none' | 'read' | 'create' | 'modify';

export function getObjectAccessLevel(
  permissions: PermissionMap | undefined,
  objectId: string
): ObjectAccessLevel {
  if (!permissions) return 'none';
  const p = permissions[objectId];
  if (!p?.read) return 'none';
  if (p.modify) return 'modify';
  if (p.create) return 'create';
  return 'read';
}

export function canViewObject(
  permissions: PermissionMap | undefined,
  objectId: string,
  loggedIn = true
): boolean {
  if (!loggedIn) {
    return !objectId.startsWith('admin_');
  }
  return getObjectAccessLevel(permissions, objectId) !== 'none';
}

export function canCreateObject(permissions: PermissionMap | undefined, objectId: string): boolean {
  const level = getObjectAccessLevel(permissions, objectId);
  return level === 'create' || level === 'modify';
}

export function canModifyObject(permissions: PermissionMap | undefined, objectId: string): boolean {
  return getObjectAccessLevel(permissions, objectId) === 'modify';
}

export function canEditDocumentRecord(
  permissions: PermissionMap | undefined,
  objectId: string,
  status: string
): boolean {
  const level = getObjectAccessLevel(permissions, objectId);
  if (level === 'none' || level === 'read') return false;
  if (status === 'cancelled' || status === 'fulfilled') return false;
  if (level === 'modify') return true;
  return status === 'draft';
}

export function canEditDocumentFields(
  permissions: PermissionMap | undefined,
  objectId: string,
  status: string,
  formMode: 'create' | 'edit' | 'view'
): boolean {
  if (formMode === 'view') return false;
  if (formMode === 'create') return canCreateObject(permissions, objectId);
  return canEditDocumentRecord(permissions, objectId, status);
}

export function canRunDocumentActions(permissions: PermissionMap | undefined, objectId: string): boolean {
  return canCreateObject(permissions, objectId);
}

export function isPostedDocumentEdit(
  permissions: PermissionMap | undefined,
  objectId: string,
  status: string
): boolean {
  return getObjectAccessLevel(permissions, objectId) === 'modify' && status === 'posted';
}

export function canEditDictionaryRecord(
  permissions: PermissionMap | undefined,
  objectId: string,
  isNew: boolean
): boolean {
  if (isNew) return canCreateObject(permissions, objectId);
  return getObjectAccessLevel(permissions, objectId) === 'modify';
}

export function canViewDictionary(permissions: PermissionMap | undefined, objectId: string): boolean {
  return canViewObject(permissions, objectId);
}
