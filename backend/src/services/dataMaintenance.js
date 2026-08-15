import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import {
  DB_PATH,
  DATA_DIR,
  COLLECTIONS,
  closeDb,
  getDb,
  ensureCollections,
  readAll,
  writeAll,
} from '../store.js';
import { hashPassword } from '../utils/password.js';
import { defaultRoles } from './permissions.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = path.join(__dirname, '..', '..');
const FACTORY_DIR = path.join(DATA_DIR, 'factory');
const FACTORY_DEMO = path.join(FACTORY_DIR, 'demo.sqlite');

/** Каталог архивов рядом с фактическим файлом БД. */
export function getBackupsDir() {
  return path.join(path.dirname(DB_PATH), 'backups');
}

function ensureBackupsDir() {
  fs.mkdirSync(getBackupsDir(), { recursive: true });
}

function stampId() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-` +
    `${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}${ms}`
  );
}

function sqliteSidecars(basePath) {
  return ['', '-wal', '-shm'].map((s) => `${basePath}${s}`);
}

function countSnapshot() {
  try {
    return {
      materials: readAll('materials').length,
      lots: readAll('lots').length,
      production_orders: readAll('production_orders').length,
      users: readAll('users').length,
      warehouses: readAll('warehouses').length,
    };
  } catch {
    return { materials: 0, lots: 0, production_orders: 0, users: 0, warehouses: 0 };
  }
}

function withSkipJsonImport(fn) {
  const prev = process.env.VILAR_SKIP_JSON_IMPORT;
  process.env.VILAR_SKIP_JSON_IMPORT = '1';
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env.VILAR_SKIP_JSON_IMPORT;
    else process.env.VILAR_SKIP_JSON_IMPORT = prev;
  }
}

/** Checkpoint + VACUUM INTO — самодостаточный файл без wal. */
function snapshotDatabaseTo(destSqlitePath) {
  ensureBackupsDir();
  fs.mkdirSync(path.dirname(destSqlitePath), { recursive: true });
  if (fs.existsSync(destSqlitePath)) fs.unlinkSync(destSqlitePath);

  const db = getDb();
  try {
    db.exec('PRAGMA wal_checkpoint(FULL);');
  } catch {
    /* ignore */
  }
  const destSql = destSqlitePath.replace(/'/g, "''");
  db.exec(`VACUUM INTO '${destSql}'`);
  if (!fs.existsSync(destSqlitePath) || fs.statSync(destSqlitePath).size < 1000) {
    throw new Error('Не удалось создать файл слепка базы');
  }
}

function writeMeta(dir, meta) {
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8');
}

function readMeta(dir) {
  const p = path.join(dir, 'meta.json');
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function replaceLiveDbFromFile(srcSqlite) {
  closeDb();
  const sleep = (ms) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      /* spin — Windows file lock release */
    }
  };
  let lastErr;
  for (let i = 0; i < 8; i++) {
    try {
      for (const p of sqliteSidecars(DB_PATH)) {
        if (fs.existsSync(p)) fs.unlinkSync(p);
      }
      lastErr = null;
      break;
    } catch (e) {
      lastErr = e;
      sleep(50 * (i + 1));
    }
  }
  if (lastErr) throw lastErr;
  try {
    fs.copyFileSync(srcSqlite, DB_PATH);
  } finally {
    getDb();
    withSkipJsonImport(() => ensureCollections());
  }
}

export function getBackupSqlitePath(id) {
  const safe = String(id || '').replace(/[^a-zA-Z0-9._-]/g, '');
  if (!safe || safe !== id) throw new Error('Некорректный id архива');
  const sqlite = path.join(getBackupsDir(), safe, 'vilar.sqlite');
  if (!fs.existsSync(sqlite)) throw new Error('Архив не найден');
  return sqlite;
}

export function listBackups() {
  ensureBackupsDir();
  const names = fs.readdirSync(getBackupsDir(), { withFileTypes: true }).filter((d) => d.isDirectory());
  const items = [];
  for (const d of names) {
    if (d.name.startsWith('_')) continue;
    const dir = path.join(getBackupsDir(), d.name);
    const sqlite = path.join(dir, 'vilar.sqlite');
    if (!fs.existsSync(sqlite)) continue;
    const st = fs.statSync(sqlite);
    const meta = readMeta(dir) || {};
    items.push({
      id: d.name,
      createdAt: meta.createdAt || st.mtime.toISOString(),
      label: meta.label || d.name,
      reason: meta.reason || '',
      sizeBytes: st.size,
      counts: meta.counts || null,
    });
  }
  items.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return items;
}


export function createBackup({ label = '', reason = 'manual' } = {}) {
  ensureCollections();
  const counts = countSnapshot();
  const id = stampId();
  const dir = path.join(getBackupsDir(), id);
  if (fs.existsSync(dir)) throw new Error('Архив с таким id уже есть, повторите');
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, 'vilar.sqlite');
  snapshotDatabaseTo(dest);
  const meta = {
    id,
    createdAt: new Date().toISOString(),
    label: String(label || id).slice(0, 120),
    reason: String(reason || 'manual').slice(0, 80),
    counts,
    dbPath: DB_PATH,
  };
  writeMeta(dir, meta);
  return { ...meta, sizeBytes: fs.statSync(dest).size };
}

export function restoreBackup(id) {
  const safe = String(id || '').replace(/[^a-zA-Z0-9._-]/g, '');
  if (!safe || safe !== id) throw new Error('Некорректный id архива');
  const dir = path.join(getBackupsDir(), safe);
  const srcSqlite = path.join(dir, 'vilar.sqlite');
  if (!fs.existsSync(srcSqlite)) throw new Error('Архив не найден');

  createBackup({ label: `before-restore-${safe}`, reason: 'before-restore' });
  replaceLiveDbFromFile(srcSqlite);
  return { ok: true, restoredId: safe, counts: countSnapshot() };
}

export function deleteBackup(id) {
  const safe = String(id || '').replace(/[^a-zA-Z0-9._-]/g, '');
  if (!safe || safe !== id) throw new Error('Некорректный id архива');
  const dir = path.join(getBackupsDir(), safe);
  if (!fs.existsSync(dir)) throw new Error('Архив не найден');
  fs.rmSync(dir, { recursive: true, force: true });
  return { ok: true, deletedId: safe };
}

/**
 * Чистый лист: пустые справочники/документы/запасы.
 * Без unlink файла БД (на Windows иначе EBUSY при открытом соединении).
 * Остаются Admin (тот же пароль), роли и два пустых склада.
 */
export function clearAllData() {
  ensureCollections();
  const adminBefore = readAll('users').find((u) => u.login === 'Admin');
  const savedHash = adminBefore?.passwordHash;

  createBackup({ label: 'before-clear', reason: 'before-clear' });

  withSkipJsonImport(() => {
    for (const name of COLLECTIONS) {
      if (name === 'users' || name === 'roles') continue;
      writeAll(name, []);
    }

    writeAll('warehouses', [
      { id: 'wh-components', name: 'Склад компонентов', type: 'компоненты' },
      { id: 'wh-finished', name: 'Склад ГП', type: 'ГП' },
    ]);

    writeAll('users', [
      {
        id: 'user-admin',
        name: 'Admin',
        login: 'Admin',
        passwordHash:
          savedHash ||
          hashPassword(String(process.env.VILAR_ADMIN_PASSWORD || '').trim() || 'Admin'),
        role: 'administrator',
        roleId: 'role-administrator',
        active: true,
      },
    ]);

    if (!readAll('roles').length) {
      writeAll('roles', defaultRoles());
    }
  });

  return { ok: true, mode: 'clear', counts: countSnapshot() };
}

function ensureFactoryDemoFromSeed(preservePasswordHash) {
  fs.mkdirSync(FACTORY_DIR, { recursive: true });
  closeDb();
  const result = spawnSync(
    process.execPath,
    ['--experimental-sqlite', path.join(BACKEND_ROOT, 'scripts', 'seed.js')],
    {
      cwd: BACKEND_ROOT,
      env: { ...process.env, VILAR_SQLITE_PATH: DB_PATH, VILAR_SKIP_JSON_IMPORT: '1' },
      encoding: 'utf8',
    }
  );
  getDb();
  withSkipJsonImport(() => {
    ensureCollections();
    if (preservePasswordHash) {
      const users = readAll('users');
      const admin = users.find((u) => u.login === 'Admin');
      if (admin) {
        admin.passwordHash = preservePasswordHash;
        writeAll('users', users);
      }
    }
  });
  if (result.status !== 0) {
    const err = (result.stderr || result.stdout || '').trim() || `seed exit ${result.status}`;
    throw new Error(`Демо-загрузка не удалась: ${err.slice(0, 500)}`);
  }
  snapshotDatabaseTo(FACTORY_DEMO);
}

/**
 * Демонстрационные данные (как при проектировании).
 * Использует заводской слепок data/factory/demo.sqlite или строит его через seed.
 */
export function loadDemoData() {
  ensureCollections();
  const adminBefore = readAll('users').find((u) => u.login === 'Admin');
  const savedHash = adminBefore?.passwordHash;

  createBackup({ label: 'before-demo', reason: 'before-demo' });

  if (!fs.existsSync(FACTORY_DEMO)) {
    ensureFactoryDemoFromSeed(savedHash);
  } else {
    replaceLiveDbFromFile(FACTORY_DEMO);
    if (savedHash) {
      const users = readAll('users');
      const admin = users.find((u) => u.login === 'Admin');
      if (admin) {
        admin.passwordHash = savedHash;
        writeAll('users', users);
      }
    }
  }

  let counts = countSnapshot();
  if ((counts.materials || 0) < 10) {
    ensureFactoryDemoFromSeed(savedHash);
    counts = countSnapshot();
  }

  return { ok: true, mode: 'demo', counts, factory: FACTORY_DEMO };
}

export function factoryDemoInfo() {
  if (!fs.existsSync(FACTORY_DEMO)) {
    return { exists: false, path: FACTORY_DEMO };
  }
  const st = fs.statSync(FACTORY_DEMO);
  return { exists: true, path: FACTORY_DEMO, sizeBytes: st.size, mtime: st.mtime.toISOString() };
}
