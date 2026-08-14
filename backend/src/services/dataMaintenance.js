import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { DB_PATH, DATA_DIR, closeDb, getDb, ensureCollections, resetDatabase, readAll } from '../store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = path.join(__dirname, '..', '..');

/** Каталог архивов рядом с фактическим файлом БД (не путать с тестовым VILAR_SQLITE_PATH). */
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
    };
  } catch {
    return { materials: 0, lots: 0, production_orders: 0, users: 0 };
  }
}

/**
 * Надёжный слепок: checkpoint + VACUUM INTO (один самодостаточный файл без wal).
 */
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

export function listBackups() {
  ensureBackupsDir();
  const names = fs.readdirSync(getBackupsDir(), { withFileTypes: true }).filter((d) => d.isDirectory());
  const items = [];
  for (const d of names) {
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

  const meta = readMeta(dir);
  if (meta?.counts && meta.counts.materials === 0 && meta.counts.lots === 0) {
    // всё равно разрешаем, но вызывающий UI предупредит; здесь только серверный след
  }

  createBackup({ label: `before-restore-${safe}`, reason: 'before-restore' });

  closeDb();
  try {
    for (const p of sqliteSidecars(DB_PATH)) {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    fs.copyFileSync(srcSqlite, DB_PATH);
  } finally {
    getDb();
    ensureCollections();
  }
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

/** Пустая БД + Admin/роли (ensureCollections). Перед этим — автобэкап. */
export function clearAllData() {
  createBackup({ label: 'before-clear', reason: 'before-clear' });
  resetDatabase();
  ensureCollections();
  return { ok: true, mode: 'clear' };
}

/** Полный демо-seed (как scripts/seed.js). Перед этим — автобэкап. */
export function loadDemoData() {
  createBackup({ label: 'before-demo', reason: 'before-demo' });
  closeDb();
  const result = spawnSync(
    process.execPath,
    ['--experimental-sqlite', path.join(BACKEND_ROOT, 'scripts', 'seed.js')],
    {
      cwd: BACKEND_ROOT,
      env: {
        ...process.env,
        // seed всегда пишет в стандартный data/vilar.sqlite, если не задан путь
        VILAR_SQLITE_PATH: DB_PATH,
      },
      encoding: 'utf8',
    }
  );
  getDb();
  ensureCollections();
  if (result.status !== 0) {
    const err = (result.stderr || result.stdout || '').trim() || `seed exit ${result.status}`;
    throw new Error(`Демо-загрузка не удалась: ${err.slice(0, 500)}`);
  }
  return { ok: true, mode: 'demo', counts: countSnapshot() };
}
