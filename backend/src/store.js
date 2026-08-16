import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { openDatabase } from './sqlite.js';
import { hashPassword, verifyPassword } from './utils/password.js';
import {
  resolveBootstrapAdminPassword,
  makeTemporaryAdminPassword,
} from './utils/adminBootstrap.js';
import { defaultRoles, normalizePermissions } from './services/permissions.js';
import { LEGACY_ROLE_MAP, ALL_SYSTEM_OBJECT_IDS, DEFAULT_ROLE_PERMISSIONS } from './constants/systemObjects.js';
import { ALL_DOCUMENT_COLLECTIONS, collectionForType } from './constants/documentTypes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = path.join(__dirname, '..', 'data');
export const DB_PATH = process.env.VILAR_SQLITE_PATH || path.join(DATA_DIR, 'vilar.sqlite');

/** Коллекции, доступные через generic CRUD. Legacy `reservations` убран. */
const COLLECTIONS = [
  'materials',
  'specifications',
  'counterparties',
  'lots',
  'series',
  'warehouses',
  'stock',
  'work_centers',
  'tech_maps',
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
  'lot_qualities',
  'quality_documents',
  'quality_register',
  'quality_history',
  'quality_scenarios',
  'user_favorites',
  'feedback',
];

const IMPORT_COLLECTIONS = [...new Set([...COLLECTIONS, 'reservations'])];

let db = null;

function jsonFilePath(name) {
  return path.join(DATA_DIR, `${name}.json`);
}

export function getDb() {
  if (db) return db;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  db = openDatabase(DB_PATH);
  db.exec(`
    CREATE TABLE IF NOT EXISTS records (
      collection TEXT NOT NULL,
      id TEXT NOT NULL,
      data TEXT NOT NULL,
      PRIMARY KEY (collection, id)
    );
    CREATE INDEX IF NOT EXISTS idx_records_collection ON records(collection);
  `);
  return db;
}

export function closeDb() {
  if (!db) return;
  db.close();
  db = null;
}

export function resetDatabase() {
  closeDb();
  for (const suffix of ['', '-wal', '-shm']) {
    const p = `${DB_PATH}${suffix}`;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
  getDb();
}

/** BEGIN IMMEDIATE. Вложенные вызовы идут в той же транзакции (без второго BEGIN). */
let writeDepth = 0;
export function runWrite(fn) {
  if (writeDepth > 0) return fn();
  writeDepth += 1;
  try {
    return getDb().transaction(fn).immediate();
  } finally {
    writeDepth -= 1;
  }
}

export function readAll(name) {
  const rows = getDb().prepare('SELECT data FROM records WHERE collection = ?').all(name);
  return rows.map((r) => JSON.parse(r.data));
}

export function writeAll(name, rows) {
  const database = getDb();
  const del = database.prepare('DELETE FROM records WHERE collection = ?');
  const ins = database.prepare('INSERT INTO records (collection, id, data) VALUES (?, ?, ?)');
  const txn = database.transaction((items) => {
    del.run(name);
    for (const item of items) {
      if (!item?.id) throw new Error(`Запись коллекции ${name} без id`);
      ins.run(name, item.id, JSON.stringify(item));
    }
  });
  txn(rows);
  return rows;
}

export function getById(name, id) {
  const row = getDb().prepare('SELECT data FROM records WHERE collection = ? AND id = ?').get(name, id);
  return row ? JSON.parse(row.data) : null;
}

export function create(name, item) {
  if (!item?.id) throw new Error(`Запись коллекции ${name} без id`);
  getDb()
    .prepare('INSERT INTO records (collection, id, data) VALUES (?, ?, ?)')
    .run(name, item.id, JSON.stringify(item));
  return item;
}

export function update(name, id, patch) {
  const current = getById(name, id);
  if (!current) return null;
  const next = { ...current, ...patch, id };
  getDb()
    .prepare('UPDATE records SET data = ? WHERE collection = ? AND id = ?')
    .run(JSON.stringify(next), name, id);
  return next;
}

export function removeMany(name, ids) {
  const stmt = getDb().prepare('DELETE FROM records WHERE collection = ? AND id = ?');
  const txn = getDb().transaction((list) => {
    let n = 0;
    for (const id of list) n += stmt.run(name, id).changes;
    return n;
  });
  return txn(ids);
}

function importJsonIfEmpty() {
  if (process.env.VILAR_SKIP_JSON_IMPORT === '1') return;
  const count = getDb().prepare('SELECT COUNT(*) AS n FROM records').get().n;
  if (count > 0) return;
  for (const name of IMPORT_COLLECTIONS) {
    const p = jsonFilePath(name);
    if (!fs.existsSync(p)) continue;
    try {
      const rows = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (Array.isArray(rows) && rows.length) writeAll(name, rows);
    } catch (e) {
      console.error(`Не удалось импортировать ${name}.json:`, e.message);
    }
  }
}

export function ensureCollections() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  getDb();
  importJsonIfEmpty();
  migrateSpecifications();
  migrateTechMapsAndSpecLinks();
  migrateWarehousesAndStock();
  migrateOrderPlanFact();
  migrateDefaultUsers();
  migrateRoles();
  migrateRolePermissionKeys();
  migrateStockDocumentsToTyped();
  migrateLegacyReservationsToDocuments();
  migrateLotQualitiesDefaults();
}

/** Пользователь Admin при пустой/миграции БД. Пароль: VILAR_ADMIN_PASSWORD (не светить в UI). */
function bootstrapAdminPasswordPlain() {
  const fromEnv = resolveBootstrapAdminPassword();
  if (fromEnv) return fromEnv;
  const tmp = makeTemporaryAdminPassword();
  console.warn(
    `VILAR_ADMIN_PASSWORD not set: Admin gets a one-time password (save it now): ${tmp}`,
  );
  return tmp;
}

function migrateDefaultUsers() {
  let users = readAll('users');
  let changed = false;

  if (!users.length) {
    users = [
      {
        id: 'user-admin',
        name: 'Admin',
        login: 'Admin',
        passwordHash: hashPassword(bootstrapAdminPasswordPlain()),
        role: 'administrator',
        roleId: 'role-administrator',
        active: true,
      },
    ];
    writeAll('users', users);
    return;
  }

  const upgradePwd = resolveBootstrapAdminPassword();

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
        u.passwordHash = hashPassword(bootstrapAdminPasswordPlain());
        changed = true;
      } else if (upgradePwd && verifyPassword('Admin', u.passwordHash)) {
        u.passwordHash = hashPassword(upgradePwd);
        changed = true;
        console.warn('Admin password upgraded from weak default via VILAR_ADMIN_PASSWORD');
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
    if (!getById(col, doc.id)) create(col, doc);
  }
  writeAll('stock_documents', []);
}

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

function migrateOrderPlanFact() {
  const orders = readAll('production_orders');
  let changed = false;
  for (const o of orders) {
    if (!Array.isArray(o.actualLines)) {
      o.actualLines = [];
      changed = true;
    }
  }
  if (changed) writeAll('production_orders', orders);
}

function migrateSpecifications() {
  const rows = readAll('specifications');
  if (!rows.length) return;
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
    if (s.qtyBasis !== 'per1000') {
      for (const line of s.lines || []) {
        if (line.qtyPerUnit != null) {
          line.qtyPerUnit = Number((Number(line.qtyPerUnit) * 1000).toFixed(8));
        }
        if ('note' in line) delete line.note;
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

/** Техкарты «Линия 1/2» + проставление techMapId в спецификациях (~поровну). */
function migrateTechMapsAndSpecLinks() {
  const workCenters = readAll('work_centers');
  if (!workCenters.length) return;

  let maps = readAll('tech_maps');
  let mapsChanged = false;

  const wc1 =
    workCenters.find((w) => /№\s*1|линия\s*1/i.test(String(w.name || ''))) || workCenters[0];
  const wc2 =
    workCenters.find((w) => w.id !== wc1.id && /№\s*2|линия\s*2/i.test(String(w.name || ''))) ||
    workCenters.find((w) => w.id !== wc1.id) ||
    wc1;

  let map1 = maps.find((m) => m.id === 'tech-map-line-1') || maps.find((m) => m.workCenterId === wc1.id);
  let map2 =
    maps.find((m) => m.id === 'tech-map-line-2') ||
    maps.find((m) => m.workCenterId === wc2.id && m.id !== map1?.id);

  if (!map1) {
    map1 = { id: 'tech-map-line-1', name: 'Техкарта: Линия 1', workCenterId: wc1.id };
    maps.push(map1);
    mapsChanged = true;
  } else if (!map1.workCenterId) {
    map1.workCenterId = wc1.id;
    mapsChanged = true;
  }
  if (!map2) {
    map2 = { id: 'tech-map-line-2', name: 'Техкарта: Линия 2', workCenterId: wc2.id };
    maps.push(map2);
    mapsChanged = true;
  } else if (!map2.workCenterId) {
    map2.workCenterId = wc2.id;
    mapsChanged = true;
  }
  if (mapsChanged) {
    writeAll('tech_maps', maps);
    maps = readAll('tech_maps');
  }

  const mapIds = new Set(maps.map((m) => m.id));
  const specs = readAll('specifications');
  if (!specs.length) return;

  let assignIdx = 0;
  let specsChanged = false;
  for (const s of specs) {
    if (s.techMapId && mapIds.has(s.techMapId)) continue;
    s.techMapId = assignIdx % 2 === 0 ? map1.id : map2.id;
    assignIdx += 1;
    specsChanged = true;
  }
  if (specsChanged) writeAll('specifications', specs);
}

/**
 * Legacy `reservations` → документ RES [posted] + active_reservations.
 * Выполняется один раз: после переноса коллекция reservations очищается.
 */
function migrateLegacyReservationsToDocuments() {
  const legacy = readAll('reservations');
  if (!legacy.length) return;

  const actor = getById('users', 'user-admin')?.id || readAll('users')[0]?.id || 'user-admin';
  const whComp = readAll('warehouses').find((w) => w.type === 'компоненты')?.id || 'wh-components';
  const today = new Date().toISOString().slice(0, 10);
  const byOrder = new Map();
  for (const r of legacy) {
    const oid = r.productionOrderId || '_none';
    if (!byOrder.has(oid)) byOrder.set(oid, []);
    byOrder.get(oid).push(r);
  }

  const existingRes = readAll('reservation_documents');

  for (const [orderId, rows] of byOrder) {
    const linked = existingRes.find(
      (d) => d.productionOrderId === orderId && (d.status === 'posted' || d.status === 'fulfilled')
    );
    if (linked) continue;

    const order = orderId !== '_none' ? getById('production_orders', orderId) : null;
    const lines = rows
      .filter((r) => r.materialId && r.lotId)
      .map((r) => ({
        id: randomUUID(),
        materialId: r.materialId,
        lotId: r.lotId,
        quantity: Number(r.quantity) || 0,
      }));
    if (!lines.length) continue;

    const seq = nextLocalNumber('RES', today);
    const docId = randomUUID();
    const doc = {
      id: docId,
      type: 'reservation',
      number: seq,
      date: today,
      time: '00:00',
      status: order?.status === 'завершен' ? 'fulfilled' : 'posted',
      warehouseId: whComp,
      warehouseFromId: null,
      warehouseToId: null,
      productionOrderId: orderId !== '_none' ? orderId : null,
      seriesId: order?.seriesId || rows[0]?.seriesId || null,
      basisDocumentId: null,
      createdByUserId: actor,
      createdAt: new Date().toISOString(),
      postedAt: new Date().toISOString(),
      postedByUserId: actor,
      cancelledAt: null,
      cancelledByUserId: null,
      fulfilledAt: order?.status === 'завершен' ? new Date().toISOString() : null,
      fulfilledByUserId: order?.status === 'завершен' ? actor : null,
      comment: 'Перенесено из legacy reservations',
      lines,
    };
    create('reservation_documents', doc);

    if (doc.status === 'posted') {
      for (const line of lines) {
        create('active_reservations', {
          id: randomUUID(),
          documentId: docId,
          productionOrderId: doc.productionOrderId,
          materialId: line.materialId,
          lotId: line.lotId,
          quantity: line.quantity,
          seriesId: doc.seriesId,
          warehouseId: whComp,
        });
      }
    }
  }

  writeAll('reservations', []);
}

/** Стартовые сценарии качества партий (пользователь может править справочник) */
function migrateLotQualitiesDefaults() {
  const existing = readAll('lot_qualities');
  if (existing.length) return;
  const seed = [
    {
      id: 'lq-fit',
      name: 'Годен',
      permission: 'fit',
      comment: 'Разрешено к использованию без ограничений',
      active: true,
    },
    {
      id: 'lq-conditional',
      name: 'Условно годен',
      permission: 'conditional',
      comment: 'Разрешено с предупреждением при планировании / закрытии',
      active: true,
    },
    {
      id: 'lq-block',
      name: 'Блокировка',
      permission: 'unfit',
      comment: 'Полный запрет использования партии',
      active: true,
    },
  ];
  writeAll('lot_qualities', seed);
}

function nextLocalNumber(code, dateStr) {
  const key = `${code}:${dateStr}`;
  const sequences = readAll('document_sequences');
  const row = sequences.find((s) => s.key === key);
  const next = (row?.last ?? 0) + 1;
  if (row) update('document_sequences', row.id, { last: next });
  else create('document_sequences', { id: randomUUID(), key, last: next });
  return `${code}-${dateStr}-${String(next).padStart(5, '0')}`;
}

export { COLLECTIONS };
