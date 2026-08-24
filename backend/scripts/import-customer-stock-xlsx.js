/**
 * Импорт контрагентов, производителей, партий и остатков из Excel заказчика.
 *
 * Пример:
 *   node scripts/import-customer-stock-xlsx.js --dry-run \
 *     --counterparties "path/to/перечни.xlsx" \
 *     --stock "path/to/остатки.xlsx"
 *   node scripts/import-customer-stock-xlsx.js --apply ...
 *
 * --apply пишет в текущую sqlite (backend/data/vilar.sqlite).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import ExcelJS from 'exceljs';
import * as store from '../src/store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function uid() {
  return randomUUID();
}

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  if (i < 0) return null;
  return process.argv[i + 1] || null;
}

function cellText(v) {
  if (v == null || v === '') return '';
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join('');
    if (v.text != null) return String(v.text);
    if (v.result != null) return cellText(v.result);
    if (v.formula != null && v.result != null) return cellText(v.result);
    return '';
  }
  return String(v);
}

function asString(v) {
  const t = cellText(v);
  if (t instanceof Date) return t.toISOString().slice(0, 10);
  return String(t || '').replace(/\u00A0/g, ' ').trim();
}

function asNumber(v) {
  const t = cellText(v);
  if (typeof t === 'number') return t;
  if (t instanceof Date) return NaN;
  const s = String(t || '')
    .replace(/\s/g, '')
    .replace(',', '.');
  if (!s) return NaN;
  return Number(s);
}

/** Базовая нормализация: пробелы, кавычки, регистр, NFKC */
export function normalizeBase(name) {
  return String(name || '')
    .normalize('NFKC')
    .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, ' ')
    .replace(/[«»„“”"'′`]/g, '')
    .replace(/[‐‑‒–—―]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Дополнительно: кириллические омоглифы → латиница (Merck KGаA, IMI Fabi S.Р.A.) */
export function normalizeLookalikes(name) {
  const map = {
    а: 'a',
    е: 'e',
    о: 'o',
    р: 'p',
    с: 'c',
    у: 'y',
    х: 'x',
    в: 'b',
    к: 'k',
    м: 'm',
    н: 'h',
    т: 't',
  };
  return normalizeBase(name).replace(/[аеорсухвкмнт]/gi, (ch) => {
    const lower = ch.toLowerCase();
    return map[lower] || ch;
  });
}

function keysForOrg(name) {
  const a = normalizeBase(name);
  const b = normalizeLookalikes(name);
  return [...new Set([a, b].filter(Boolean))];
}

function normalizeMaterialKey(name) {
  return normalizeBase(name)
    .replace(/ё/g, 'е')
    .replace(/меш/g, 'м')
    .replace(/[^0-9a-zа-я]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Явные алиасы Excel → имя материала в БД */
const MATERIAL_ALIASES = {
  [normalizeMaterialKey('Титан оксид')]: 'Титана диоксид (двуокись титана)',
  [normalizeMaterialKey('Лактозы моногидрат (200М)')]:
    'Лактоза моногидрат (сахар молочный, лактоза) 200 МЕШ',
  [normalizeMaterialKey('Лактозы моногидрат (80М)')]:
    'Лактоза моногидрат (сахар молочный, лактоза) 80 МЕШ',
  [normalizeMaterialKey('Аэросил')]: 'Кремния диоксид коллоидный (Аэросил А-380)',
  [normalizeMaterialKey('Магния карбонат')]:
    'Магния карбонат основной (магния гидроксикарбонат)',
  [normalizeMaterialKey('Гидроксипропилметилцеллюлоза')]: 'Гипромеллоза',
  [normalizeMaterialKey('Гипромеллоза')]: 'Гипромеллоза',
};

function fixExcelDate(value, { peerYear } = {}) {
  if (value == null || value === '') return null;
  let d = null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    d = new Date(value.getTime());
  } else {
    const s = asString(value);
    if (!s) return null;
    // MM.YYYY / YYYY-MM / YYYY-MM-DD
    let m = s.match(/^(\d{1,2})[./](\d{4})$/);
    if (m) d = new Date(Date.UTC(Number(m[2]), Number(m[1]) - 1, 1));
    m = s.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
    if (!d && m) d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3] || 1)));
    m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/);
    if (!d && m) {
      let y = Number(m[3]);
      if (y < 100) y += 2000;
      d = new Date(Date.UTC(y, Number(m[2]) - 1, Number(m[1])));
    }
  }
  if (!d || Number.isNaN(d.getTime())) return null;

  // Excel часто даёт 1930 вместо 2030 при «01.30»
  let year = d.getUTCFullYear();
  if (year >= 1900 && year < 2000) {
    const peer = peerYear || new Date().getUTCFullYear();
    if (peer >= 2000 || year < 1950) year += 100;
  }
  const month = d.getUTCMonth();
  // Допущение: день всегда 01
  return `${year}-${String(month + 1).padStart(2, '0')}-01`;
}

async function readWorkbook(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Файл не найден: ${filePath}`);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  return wb;
}

function sheetRows(ws) {
  const rows = [];
  for (let r = 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const vals = [];
    const colCount = Math.max(ws.columnCount || 0, 10);
    for (let c = 1; c <= colCount; c++) vals.push(row.getCell(c).value);
    if (vals.every((v) => asString(v) === '' && !(v instanceof Date))) continue;
    rows.push(vals);
  }
  return rows;
}

function findSheet(wb, predicates) {
  for (const ws of wb.worksheets) {
    const name = String(ws.name || '').toLowerCase();
    if (predicates.some((p) => p(name))) return ws;
  }
  return wb.worksheets[0];
}

class OrgIndex {
  constructor(collection, label) {
    this.collection = collection;
    this.label = label;
    this.byKey = new Map();
    this.created = [];
    this.reused = [];
    this.reconcile = []; // { from, to, via }
    for (const row of store.readAll(collection)) {
      this.#index(row, false);
    }
  }

  #index(row, isNew) {
    for (const k of keysForOrg(row.name)) {
      if (!this.byKey.has(k)) this.byKey.set(k, row);
    }
    if (isNew) this.created.push(row);
  }

  resolve(rawName, { createIfMissing = true, address = '' } = {}) {
    const name = asString(rawName);
    if (!name) return null;
    const keys = keysForOrg(name);
    for (const k of keys) {
      const hit = this.byKey.get(k);
      if (hit) {
        if (normalizeBase(hit.name) !== normalizeBase(name)) {
          this.reconcile.push({ from: name, to: hit.name, via: k });
        }
        this.reused.push({ asked: name, got: hit.name, id: hit.id });
        return hit;
      }
    }
    if (!createIfMissing) return null;
    const row = { id: uid(), name, ...(address ? { address } : {}) };
    store.create(this.collection, row);
    this.#index(row, true);
    return row;
  }
}

function buildMaterialIndex() {
  const byKey = new Map();
  const materials = store.readAll('materials');
  for (const m of materials) {
    const k = normalizeMaterialKey(m.name);
    if (!byKey.has(k)) byKey.set(k, m);
    // короткий ключ без скобок
    const short = k.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
    if (short && !byKey.has(short)) byKey.set(short, m);
  }
  return { materials, byKey };
}

function resolveMaterial(name, index) {
  const raw = asString(name);
  if (!raw) return { error: 'пустое наименование материала' };
  const key = normalizeMaterialKey(raw);
  const aliasTarget = MATERIAL_ALIASES[key];
  if (aliasTarget) {
    const aliasKey = normalizeMaterialKey(aliasTarget);
    const hit = index.byKey.get(aliasKey);
    if (hit) return { material: hit, via: `alias→${aliasTarget}` };
  }
  let hit = index.byKey.get(key);
  if (hit) return { material: hit, via: 'exact' };

  // contains: excel name inside db name or vice versa
  const candidates = index.materials.filter((m) => {
    const mk = normalizeMaterialKey(m.name);
    return mk.includes(key) || key.includes(mk);
  });
  if (candidates.length === 1) return { material: candidates[0], via: 'fuzzy' };
  if (candidates.length > 1) {
    return {
      error: `несколько материалов: ${candidates.map((c) => c.name).join(' | ')}`,
    };
  }
  return { error: `материал не найден: «${raw}»` };
}

async function loadDirectories(cpPath) {
  const wb = await readWorkbook(cpPath);
  const mfrSheet = findSheet(wb, [(n) => n.includes('производител')]);
  const cpSheet = findSheet(wb, [(n) => n.includes('поставщик') || n.includes('контрагент')]);

  const manufacturers = [];
  for (const vals of sheetRows(mfrSheet).slice(1)) {
    const name = asString(vals[1]);
    if (!name || /^\d+$/.test(name) || name.toLowerCase().includes('наименование')) continue;
    manufacturers.push({ name, address: asString(vals[2]) });
  }

  const counterparties = [];
  for (const vals of sheetRows(cpSheet).slice(1)) {
    const name = asString(vals[1]);
    if (!name || /^\d+$/.test(name) || name.toLowerCase().includes('наименование')) continue;
    counterparties.push({ name, address: asString(vals[2]) });
  }

  return { manufacturers, counterparties };
}

async function loadStock(stockPath) {
  const wb = await readWorkbook(stockPath);
  const ws = wb.worksheets[0];
  const rows = [];
  for (const vals of sheetRows(ws).slice(1)) {
    const materialName = asString(vals[0]);
    if (!materialName || materialName.toLowerCase().includes('наименование')) continue;
    const qtyRaw = asNumber(vals[4]);
    let quantity = qtyRaw;
    // В выгрузке для лактозы 80М одно значение без десятичного разделителя (49832 вместо 49.832)
    if (
      Number.isFinite(qtyRaw) &&
      qtyRaw === 49832 &&
      /лактоз/i.test(materialName) &&
      /80/i.test(materialName)
    ) {
      quantity = 49.832;
    }
    const prodRaw = vals[5];
    const expRaw = vals[6];
    const productionDate = fixExcelDate(prodRaw);
    const expiryDate = fixExcelDate(expRaw, {
      peerYear: productionDate ? Number(productionDate.slice(0, 4)) : undefined,
    });
    rows.push({
      materialName,
      supplierName: asString(vals[1]),
      manufacturerName: asString(vals[2]),
      lotNumberExcel: asString(vals[3]),
      quantity,
      quantityRaw: qtyRaw,
      productionDate,
      expiryDate,
      productionRaw: asString(prodRaw),
      expiryRaw: asString(expRaw),
    });
  }
  return rows;
}

function nextLotSeq(existingLots) {
  let max = 0;
  for (const l of existingLots) {
    const m = String(l.number || '').match(/^(\d{5})$/);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

function warehouseComponentsId() {
  const wh =
    store.readAll('warehouses').find((w) => w.type === 'компоненты') ||
    store.readAll('warehouses').find((w) => /компонент/i.test(w.name || ''));
  if (!wh) throw new Error('Не найден склад типа «компоненты»');
  return wh.id;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run') || !process.argv.includes('--apply');
  const cpPath = argValue('--counterparties');
  const stockPath = argValue('--stock');
  if (!cpPath || !stockPath) {
    console.error(
      'Нужны --counterparties <xlsx> и --stock <xlsx>. Для записи добавьте --apply (иначе dry-run).'
    );
    process.exit(1);
  }

  const { manufacturers: mfrList, counterparties: cpList } = await loadDirectories(cpPath);
  const stockRows = await loadStock(stockPath);
  const matIndex = buildMaterialIndex();
  const whId = warehouseComponentsId();

  const report = {
    mode: dryRun ? 'dry-run' : 'apply',
    directories: { manufacturers: mfrList.length, counterparties: cpList.length },
    stockRows: stockRows.length,
    created: { manufacturers: 0, counterparties: 0, lots: 0, stock: 0 },
    reused: { manufacturers: 0, counterparties: 0 },
    reconcile: [],
    warnings: [],
    errors: [],
    lotsPreview: [],
  };

  const run = () => {
    const mfrIdx = new OrgIndex('manufacturers', 'производитель');
    const cpIdx = new OrgIndex('counterparties', 'контрагент');

    for (const row of mfrList) {
      mfrIdx.resolve(row.name, { address: row.address });
    }
    for (const row of cpList) {
      cpIdx.resolve(row.name, { address: row.address });
    }

    // Сверка: одно и то же после нормализации в обоих списках / внутри списка
    const allOrgNames = [
      ...mfrList.map((x) => ({ kind: 'mfr', name: x.name })),
      ...cpList.map((x) => ({ kind: 'cp', name: x.name })),
      ...stockRows.flatMap((r) => [
        { kind: 'stock-cp', name: r.supplierName },
        { kind: 'stock-mfr', name: r.manufacturerName },
      ]),
    ].filter((x) => x.name);

    const groups = new Map();
    for (const item of allOrgNames) {
      for (const k of keysForOrg(item.name)) {
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(item);
      }
    }
    for (const [k, items] of groups) {
      const uniq = [...new Set(items.map((i) => i.name))];
      if (uniq.length > 1) {
        report.reconcile.push({ key: k, variants: uniq });
      }
    }

    let seq = nextLotSeq(store.readAll('lots'));
    for (const row of stockRows) {
      const mat = resolveMaterial(row.materialName, matIndex);
      if (mat.error) {
        report.errors.push(`${row.materialName}: ${mat.error}`);
        continue;
      }
      if (!Number.isFinite(row.quantity) || row.quantity < 0) {
        report.errors.push(`${row.materialName}: некорректное количество «${row.quantity}»`);
        continue;
      }
      if (row.quantityRaw === 49832 && row.quantity === 49.832) {
        report.warnings.push(
          `${row.materialName}: количество 49832 исправлено на 49.832 (пропущен десятичный разделитель)`
        );
      }
      if (row.quantity > 5000) {
        report.warnings.push(
          `${row.materialName}: подозрительно большое количество ${row.quantity} кг (проверьте десятичный разделитель)`
        );
      }
      if (!row.productionDate && row.productionRaw) {
        report.warnings.push(`${row.materialName}: не разобрана дата производства «${row.productionRaw}»`);
      }
      if (!row.expiryDate && row.expiryRaw) {
        report.warnings.push(`${row.materialName}: не разобран срок годности «${row.expiryRaw}»`);
      }
      if (row.expiryRaw && /193\d/.test(row.expiryRaw) && row.expiryDate?.startsWith('20')) {
        report.warnings.push(
          `${row.materialName}: срок ${row.expiryRaw} → ${row.expiryDate} (год +100 от Excel 19xx)`
        );
      }

      const cp = row.supplierName
        ? cpIdx.resolve(row.supplierName, { createIfMissing: true })
        : null;
      const mfr = row.manufacturerName
        ? mfrIdx.resolve(row.manufacturerName, { createIfMissing: true })
        : null;

      const number = String(seq).padStart(5, '0');
      seq += 1;

      const lot = {
        id: uid(),
        number,
        materialId: mat.material.id,
        counterpartyId: cp?.id || null,
        manufacturerId: mfr?.id || null,
        productionDate: row.productionDate || '',
        expiryDate: row.expiryDate || '',
      };

      const stock = {
        id: uid(),
        materialId: mat.material.id,
        lotId: lot.id,
        warehouseId: whId,
        quantity: Number(Number(row.quantity).toFixed(6)),
      };

      if (!dryRun) {
        store.create('lots', lot);
        store.create('stock', stock);
      }

      report.lotsPreview.push({
        number: lot.number,
        material: mat.material.name,
        via: mat.via,
        qty: stock.quantity,
        supplier: cp?.name || '—',
        manufacturer: mfr?.name || '—',
        productionDate: lot.productionDate || '—',
        expiryDate: lot.expiryDate || '—',
      });
    }

    report.created.manufacturers = mfrIdx.created.length;
    report.created.counterparties = cpIdx.created.length;
    report.created.lots = report.lotsPreview.length;
    report.created.stock = report.lotsPreview.length;
    report.reused.manufacturers = mfrIdx.reused.length;
    report.reused.counterparties = cpIdx.reused.length;

    // уникальные сверки имён из OrgIndex
    const seen = new Set();
    for (const r of [...mfrIdx.reconcile, ...cpIdx.reconcile]) {
      const id = `${r.from}=>${r.to}`;
      if (seen.has(id)) continue;
      seen.add(id);
      report.reconcile.push({ matchedAs: r.to, asked: r.from });
    }
  };

  if (dryRun) {
    // dry-run: не трогаем БД — симулируем в памяти через временные объекты без create
    // Для простоты применяем в транзакции и откатываем нельзя в store —
    // поэтому dry-run только читает и печатает план без store.create.
    // Реализуем отдельную ветку без записи:
    await dryRunPlan(cpList, mfrList, stockRows, matIndex, whId, report);
  } else {
    store.runWrite(() => {
      run();
    });
  }

  console.log(JSON.stringify(report, null, 2));
  if (report.errors.length) {
    console.error(`\nОшибок: ${report.errors.length}`);
    process.exitCode = 1;
  } else {
    console.error(`\nOK (${report.mode}): lots=${report.created.lots}`);
  }
}

async function dryRunPlan(cpList, mfrList, stockRows, matIndex, whId, report) {
  // Индексы поверх текущей БД + «виртуальные» создания
  const virtualCp = new Map();
  const virtualMfr = new Map();

  const ensureVirtual = (map, collection, name, address) => {
    const keys = keysForOrg(name);
    for (const k of keys) {
      const existing = store.readAll(collection).find((r) => keysForOrg(r.name).includes(k));
      if (existing) {
        if (normalizeBase(existing.name) !== normalizeBase(name)) {
          report.reconcile.push({ asked: name, matchedAs: existing.name });
        }
        return { row: existing, created: false };
      }
      if (map.has(k)) return { row: map.get(k), created: false };
    }
    const row = { id: `new-${map.size + 1}`, name, address };
    for (const k of keys) map.set(k, row);
    return { row, created: true };
  };

  let createdCp = 0;
  let createdMfr = 0;
  for (const row of mfrList) {
    const r = ensureVirtual(virtualMfr, 'manufacturers', row.name, row.address);
    if (r.created) createdMfr += 1;
  }
  for (const row of cpList) {
    const r = ensureVirtual(virtualCp, 'counterparties', row.name, row.address);
    if (r.created) createdCp += 1;
  }

  const allOrgNames = [
    ...mfrList.map((x) => x.name),
    ...cpList.map((x) => x.name),
    ...stockRows.map((r) => r.supplierName),
    ...stockRows.map((r) => r.manufacturerName),
  ].filter(Boolean);
  const groups = new Map();
  for (const name of allOrgNames) {
    for (const k of keysForOrg(name)) {
      if (!groups.has(k)) groups.set(k, new Set());
      groups.get(k).add(name);
    }
  }
  for (const [k, set] of groups) {
    if (set.size > 1) report.reconcile.push({ key: k, variants: [...set] });
  }

  let seq = nextLotSeq(store.readAll('lots'));
  for (const row of stockRows) {
    const mat = resolveMaterial(row.materialName, matIndex);
    if (mat.error) {
      report.errors.push(`${row.materialName}: ${mat.error}`);
      continue;
    }
    if (!Number.isFinite(row.quantity) || row.quantity < 0) {
      report.errors.push(`${row.materialName}: некорректное количество`);
      continue;
    }
      if (row.quantityRaw === 49832 && row.quantity === 49.832) {
        report.warnings.push(
          `${row.materialName}: количество 49832 исправлено на 49.832 (пропущен десятичный разделитель)`
        );
      }
      if (row.quantity > 5000) {
        report.warnings.push(
          `${row.materialName}: подозрительно большое количество ${row.quantity} кг (проверьте десятичный разделитель)`
        );
      }
    if (row.expiryDate && row.expiryRaw && /19\d{2}/.test(String(row.expiryRaw))) {
      // already fixed in loadStock
    }
    if (row.expiryDate?.startsWith('20') && /193\d/.test(row.expiryRaw || '')) {
      report.warnings.push(
        `${row.materialName}: срок «${row.expiryRaw}» исправлен в ${row.expiryDate}`
      );
    }

    let cpName = '—';
    let mfrName = '—';
    if (row.supplierName) {
      const r = ensureVirtual(virtualCp, 'counterparties', row.supplierName, '');
      if (r.created) createdCp += 1;
      cpName = r.row.name;
    }
    if (row.manufacturerName) {
      const r = ensureVirtual(virtualMfr, 'manufacturers', row.manufacturerName, '');
      if (r.created) createdMfr += 1;
      mfrName = r.row.name;
    }

    const number = String(seq).padStart(5, '0');
    seq += 1;
    report.lotsPreview.push({
      number,
      material: mat.material.name,
      via: mat.via,
      qty: row.quantity,
      supplier: cpName,
      manufacturer: mfrName,
      productionDate: row.productionDate || '—',
      expiryDate: row.expiryDate || '—',
      warehouseId: whId,
    });
  }

  report.created.manufacturers = createdMfr;
  report.created.counterparties = createdCp;
  report.created.lots = report.lotsPreview.length;
  report.created.stock = report.lotsPreview.length;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
