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
  'warehouses',
  'stock',
  'reservations',
  'work_centers',
  'planned_series_volumes',
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
  migrateSpecifications();
  migrateWarehousesAndStock();
  migrateOrderPlanFact();
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
