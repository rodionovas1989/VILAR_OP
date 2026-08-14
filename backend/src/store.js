import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { hashPassword } from './utils/password.js';
import { defaultRoles, normalizePermissions } from './services/permissions.js';
import { LEGACY_ROLE_MAP, ALL_SYSTEM_OBJECT_IDS, DEFAULT_ROLE_PERMISSIONS } from './constants/systemObjects.js';
import { ALL_DOCUMENT_COLLECTIONS, collectionForType } from './constants/documentTypes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = path.join(__dirname, '..', 'data');

const COLLECTIONS = [
  'materials',
  'specifications',
  'counterparties',
  'lots',
  'series',
  'warehouses',
  'stock',
  'reservations',
  'work_centers',
  'planned_series_volumes',
  'production_orders',
  'material_movements',
  'users',
  'roles',
  'stock_documents',
  ...ALL_DOCUMENT_COLLECTIONS,
  'active_reservations',
  'reservation_history',
  'document_sequences',
  'quality_documents',
  'quality_register',
  'quality_history',
  'user_favorites',
];

function filePath(name) {
  return path.join(DATA_DIR, `${name}.json`);
}

export function readAll(name) {
  const p = filePath(name);
  if (!fs.existsSync(p)) return [];
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

export function writeAll(name, rows) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(filePath(name), JSON.stringify(rows, null, 2), 'utf8');
  return rows;
}

export function getById(name, id) {
  return readAll(name).find((r) => r.id === id) || null;
}

export function create(name, item) {
  const rows = readAll(name);
  rows.push(item);
  writeAll(name, rows);
  return item;
}

export function update(name, id, patch) {
  const rows = readAll(name);
  const idx = rows.findIndex((r) => r.id === id);
  if (idx < 0) return null;
  rows[idx] = { ...rows[idx], ...patch, id };
  writeAll(name, rows);
  return rows[idx];
}

export function removeMany(name, ids) {
  const idSet = new Set(ids);
  const rows = readAll(name);
  const next = rows.filter((r) => !idSet.has(r.id));
  writeAll(name, next);
  return rows.length - next.length;
}

export function ensureCollections() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  for (const c of COLLECTIONS) {
    if (!fs.existsSync(filePath(c))) writeAll(c, []);
  }
  migrateSpecifications();
  migrateWarehousesAndStock();
  migrateOrderPlanFact();
  migrateDefaultUsers();
  migrateRoles();
  migrateRolePermissionKeys();
  migrateStockDocumentsToTyped();
}

/** Пользователь по умолчанию: Admin / Admin */
function migrateDefaultUsers() {
  let users = readAll('users');
  let changed = false;

  if (!users.length) {
    users = [
      {
        id: 'user-admin',
        name: 'Admin',
        login: 'Admin',
        passwordHash: hashPassword('Admin'),
        role: 'administrator',
        roleId: 'role-administrator',
        active: true,
      },
    ];
    writeAll('users', users);
    return;
  }

  for (const u of users) {
    if (u.id === 'user-admin' || u.login === 'Admin' || u.login === 'admin') {
      if (u.login !== 'Admin') {
        u.login = 'Admin';
        changed = true;
      }
      if (u.name !== 'Admin') {
        u.name = 'Admin';
        changed = true;
      }
      if (!u.passwordHash) {
        u.passwordHash = hashPassword('Admin');
        changed = true;
      }
    }
  }
  if (changed) writeAll('users', users);
}

function migrateRoles() {
  let roles = readAll('roles');
  if (!roles.length) {
    writeAll('roles', defaultRoles());
    roles = readAll('roles');
  }

  let users = readAll('users');
  let usersChanged = false;
  for (const u of users) {
    if (!u.roleId && u.role && LEGACY_ROLE_MAP[u.role]) {
      u.roleId = LEGACY_ROLE_MAP[u.role];
      usersChanged = true;
    }
    if (u.id === 'user-admin' && !u.roleId) {
      u.roleId = 'role-administrator';
      usersChanged = true;
    }
  }
  if (usersChanged) writeAll('users', users);
}

/** Новые объекты RBAC — добавить в существующие роли без перезаписи настроенных прав */
function migrateRolePermissionKeys() {
  let roles = readAll('roles');
  let changed = false;
  for (const role of roles) {
    if (!role.permissions) role.permissions = {};
    const defFn = DEFAULT_ROLE_PERMISSIONS[role.id];
    const defaults = defFn ? defFn() : {};
    let roleChanged = false;
    for (const id of ALL_SYSTEM_OBJECT_IDS) {
      if (role.permissions[id] === undefined) {
        role.permissions[id] = defaults[id] || { read: false, create: false, modify: false };
        roleChanged = true;
      }
    }
    if (roleChanged) {
      role.permissions = normalizePermissions(role.permissions);
      changed = true;
    }
  }
  if (changed) writeAll('roles', roles);
}

/** Перенос legacy stock_documents → отдельные коллекции по типу */
function migrateStockDocumentsToTyped() {
  const legacy = readAll('stock_documents');
  if (!legacy.length) return;

  for (const doc of legacy) {
    if (!doc.type) continue;
    let col;
    try {
      col = collectionForType(doc.type);
    } catch {
      continue;
    }
    const bucket = readAll(col);
    if (!bucket.some((d) => d.id === doc.id)) {
      bucket.push(doc);
      writeAll(col, bucket);
    }
  }
  writeAll('stock_documents', []);
}

/** Склады по умолчанию + привязка запасов */
function migrateWarehousesAndStock() {
  let warehouses = readAll('warehouses');
  let changedWh = false;
  if (!warehouses.some((w) => w.type === 'компоненты')) {
    warehouses.push({ id: 'wh-components', name: 'Склад компонентов', type: 'компоненты' });
    changedWh = true;
  }
  if (!warehouses.some((w) => w.type === 'ГП')) {
    warehouses.push({ id: 'wh-finished', name: 'Склад ГП', type: 'ГП' });
    changedWh = true;
  }
  if (changedWh) writeAll('warehouses', warehouses);
  warehouses = readAll('warehouses');
  const whComp = warehouses.find((w) => w.type === 'компоненты')?.id;
  const whFg = warehouses.find((w) => w.type === 'ГП')?.id;

  const materials = readAll('materials');
  const stock = readAll('stock');
  let changedStock = false;
  for (const s of stock) {
    if (s.warehouseId) continue;
    const mat = materials.find((m) => m.id === s.materialId);
    s.warehouseId = mat?.type === 'продукт' ? whFg : whComp;
    changedStock = true;
  }
  if (changedStock) writeAll('stock', stock);
}

/** План/факт в заказах */
function migrateOrderPlanFact() {
  const orders = readAll('production_orders');
  let changed = false;
  for (const o of orders) {
    if (o.actualQuantity == null && o.quantity != null) {
      // факт ещё не вводили — не копируем, пока не откроют производство / не подтвердят резерв
    }
    if (!Array.isArray(o.actualLines)) {
      o.actualLines = [];
      changed = true;
    }
  }
  if (changed) writeAll('production_orders', orders);
}

/** Убрать префикс «Спецификация:», type, норма расхода на 1000 уп */
function migrateSpecifications() {
  const p = filePath('specifications');
  if (!fs.existsSync(p)) return;
  const rows = readAll('specifications');
  let changed = false;
  for (const s of rows) {
    if (typeof s.name === 'string' && s.name.startsWith('Спецификация: ')) {
      s.name = s.name.slice('Спецификация: '.length);
      changed = true;
    }
    if (!s.type) {
      s.type = 'Основная';
      changed = true;
    }
    // Перевод нормы с «кг на 1 уп» → «кг на 1000 уп» (один раз)
    if (s.qtyBasis !== 'per1000') {
      for (const line of s.lines || []) {
        if (line.qtyPerUnit != null) {
          line.qtyPerUnit = Number((Number(line.qtyPerUnit) * 1000).toFixed(8));
        }
        if ('note' in line) {
          delete line.note;
        }
      }
      s.qtyBasis = 'per1000';
      changed = true;
    } else {
      for (const line of s.lines || []) {
        if ('note' in line) {
          delete line.note;
          changed = true;
        }
      }
    }
  }
  if (changed) writeAll('specifications', rows);
}

export { COLLECTIONS };
