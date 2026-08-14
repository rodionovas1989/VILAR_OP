import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { DB_PATH, DATA_DIR, closeDb, getDb, ensureCollections, resetDatabase } from '../store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = path.join(__dirname, '..', '..');
export const BACKUPS_DIR = path.join(DATA_DIR, 'backups');

function ensureBackupsDir() {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
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

/** Закрыть БД, скопировать sqlite (+ wal/shm) в каталог, снова открыть. */
function copyLiveDbInto(destDir) {
  ensureBackupsDir();
  fs.mkdirSync(destDir, { recursive: true });
  closeDb();
  try {
    let copied = 0;
    const pairs = [
      [DB_PATH, path.join(destDir, 'vilar.sqlite')],
      [`${DB_PATH}-wal`, path.join(destDir, 'vilar.sqlite-wal')],
      [`${DB_PATH}-shm`, path.join(destDir, 'vilar.sqlite-shm')],
    ];
    for (const [src, dest] of pairs) {
      if (!fs.existsSync(src)) continue;
      fs.copyFileSync(src, dest);
      copied += 1;
    }
    if (copied === 0) throw new Error('Файл базы vilar.sqlite не найден');
  } finally {
    getDb();
    ensureCollections();
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
  const names = fs.readdirSync(BACKUPS_DIR, { withFileTypes: true }).filter((d) => d.isDirectory());
  const items = [];
  for (const d of names) {
    const dir = path.join(BACKUPS_DIR, d.name);
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
    });
  }
  items.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return items;
}

export function createBackup({ label = '', reason = 'manual' } = {}) {
  const id = stampId();
  const dir = path.join(BACKUPS_DIR, id);
  if (fs.existsSync(dir)) throw new Error('Архив с таким id уже есть, повторите');
  copyLiveDbInto(dir);
  const meta = {
    id,
    createdAt: new Date().toISOString(),
    label: String(label || id).slice(0, 120),
    reason: String(reason || 'manual').slice(0, 80),
  };
  writeMeta(dir, meta);
  return { ...meta, sizeBytes: fs.statSync(path.join(dir, 'vilar.sqlite')).size };
}

export function restoreBackup(id) {
  const safe = String(id || '').replace(/[^a-zA-Z0-9._-]/g, '');
  if (!safe || safe !== id) throw new Error('Некорректный id архива');
  const dir = path.join(BACKUPS_DIR, safe);
  const srcSqlite = path.join(dir, 'vilar.sqlite');
  if (!fs.existsSync(srcSqlite)) throw new Error('Архив не найден');

  createBackup({ label: `before-restore-${safe}`, reason: 'before-restore' });

  closeDb();
  try {
    for (const p of sqliteSidecars(DB_PATH)) {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    for (const suffix of ['', '-wal', '-shm']) {
      const src = path.join(dir, `vilar.sqlite${suffix}`);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, `${DB_PATH}${suffix}`);
      }
    }
  } finally {
    getDb();
    ensureCollections();
  }
  return { ok: true, restoredId: safe };
}

export function deleteBackup(id) {
  const safe = String(id || '').replace(/[^a-zA-Z0-9._-]/g, '');
  if (!safe || safe !== id) throw new Error('Некорректный id архива');
  const dir = path.join(BACKUPS_DIR, safe);
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
      env: { ...process.env },
      encoding: 'utf8',
    }
  );
  getDb();
  ensureCollections();
  if (result.status !== 0) {
    const err = (result.stderr || result.stdout || '').trim() || `seed exit ${result.status}`;
    throw new Error(`Демо-загрузка не удалась: ${err.slice(0, 500)}`);
  }
  return { ok: true, mode: 'demo' };
}
