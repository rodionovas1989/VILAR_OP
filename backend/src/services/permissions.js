import * as store from '../store.js';
import {
  ALL_SYSTEM_OBJECT_IDS,
  LEGACY_ROLE_MAP,
  emptyPermissions,
  fullPermissions,
  plannerPermissions,
  storekeeperPermissions,
} from '../constants/systemObjects.js';

export function resolveRoleId(user) {
  if (!user) return null;
  if (user.roleId) return user.roleId;
  if (user.role && LEGACY_ROLE_MAP[user.role]) return LEGACY_ROLE_MAP[user.role];
  return null;
}

export function getRoleById(roleId) {
  if (!roleId) return null;
  return store.getById('roles', roleId);
}

export function resolveUserPermissions(user) {
  if (!user) return emptyPermissions();
  const roleId = resolveRoleId(user);
  const role = getRoleById(roleId);
  if (!role?.permissions) return emptyPermissions();
  return normalizePermissions(role.permissions);
}

export function normalizePermissions(raw) {
  const out = emptyPermissions();
  for (const id of ALL_SYSTEM_OBJECT_IDS) {
    const p = raw[id] || {};
    out[id] = {
      read: Boolean(p.read),
      create: Boolean(p.create),
      modify: Boolean(p.modify),
    };
    if (out[id].modify) {
      out[id].read = true;
      out[id].create = true;
    } else if (out[id].create) {
      out[id].read = true;
    }
  }
  return out;
}

export function getAccessLevel(permissions, objectId) {
  const p = permissions?.[objectId];
  if (!p?.read) return 'none';
  if (p.modify) return 'modify';
  if (p.create) return 'create';
  return 'read';
}

export function defaultRoles() {
  return [
    {
      id: 'role-administrator',
      name: 'Администратор',
      code: 'administrator',
      permissions: fullPermissions(),
    },
    {
      id: 'role-storekeeper',
      name: 'Кладовщик',
      code: 'storekeeper',
      permissions: storekeeperPermissions(),
    },
    {
      id: 'role-planner',
      name: 'Планировщик',
      code: 'planner',
      permissions: plannerPermissions(),
    },
  ];
}
