import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = path.join(__dirname, '..', 'data');

const COLLECTIONS = [
  'materials',
  'specifications',
  'counterparties',
  'lots',
  'series',
  'stock',
  'reservations',
  'work_centers',
  'production_orders',
  'material_movements',
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
}

export { COLLECTIONS };
