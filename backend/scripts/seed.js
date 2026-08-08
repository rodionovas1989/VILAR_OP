/**
 * Генерация демо-данных: справочники из рецептур + симуляция запасов/заказов на месяц.
 * Нормы: 2 линии × ~25000 уп/сутки; 1–2 серии/сутки на линию.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
const recipes = JSON.parse(fs.readFileSync(path.join(__dirname, 'recipes_raw.json'), 'utf8'));

const rnd = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[rnd(0, arr.length - 1)];
const uid = () => randomUUID();

function parseQty(qty) {
  if (qty == null || qty === '' || String(qty).toLowerCase().includes('не указано')) return null;
  const n = Number(String(qty).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Оценка мг на таблетку, если в источнике «не указано» */
function estimateQtyMg(compName, type) {
  const n = compName.toLowerCase();
  if (type === 'Активный') return 50;
  if (n.includes('лактоз') || n.includes('сахароз') || n.includes('сахар') || n.includes('сорбит')) return 120;
  if (n.includes('крахмал') || n.includes('целлюлоз')) return 40;
  if (n.includes('стеарат') || n.includes('тальк') || n.includes('аэросил') || n.includes('кремния')) return 3;
  if (n.includes('повидон') || n.includes('гипромеллоз') || n.includes('кроскармеллоз') || n.includes('кармеллоз')) return 8;
  return 15;
}

const COUNTERPARTY_POOL = [
  'ООО «ФармСырьё»',
  'АО «ХимПоставка»',
  'ООО «БиоИнгредиент»',
  'ЗАО «МедКомпонент»',
  'ООО «АктивФарм Логистика»',
  'ИП Сырьевой Д.В.',
  'ООО «ЕвроЭксципиент»',
  'АО «Субстанция-Трейд»',
];

function buildMaterialsAndSpecs() {
  const materialsByName = new Map();
  const productsKey = new Map(); // prep|form|dosage -> materialId

  const ensureMaterial = (name, type) => {
    if (materialsByName.has(name)) return materialsByName.get(name);
    const id = uid();
    const mat = { id, name, type, unit: type === 'продукт' ? 'уп' : 'кг' };
    materialsByName.set(name, mat);
    return mat;
  };

  for (const row of recipes) {
    const key = `${row.prep}|${row.form}|${row.dosage || ''}`;
    if (!productsKey.has(key)) {
      const label = [row.prep, row.form, row.dosage].filter(Boolean).join(', ');
      const mat = ensureMaterial(label, 'продукт');
      productsKey.set(key, mat.id);
    }
  }

  for (const row of recipes) {
    const type = row.type === 'Активный' ? 'основной компонент' : 'вспомогательный компонент';
    ensureMaterial(row.comp, type);
  }

  const specifications = [];
  for (const [key, productId] of productsKey) {
    const [prep, form, dosage] = key.split('|');
    const lines = recipes
      .filter((r) => r.prep === prep && r.form === form && (r.dosage || '') === dosage)
      .map((r) => {
        const mat = materialsByName.get(r.comp);
        let qtyMg = parseQty(r.qty);
        if (qtyMg == null) qtyMg = estimateQtyMg(r.comp, r.type);
        // мг → кг на 1 упаковку (считаем 1 уп = 30 таблеток по умолчанию)
        const tabletsPerPack = 30;
        const qtyKgPerPack = (qtyMg * tabletsPerPack) / 1_000_000;
        return {
          materialId: mat.id,
          qtyPerUnit: Number(qtyKgPerPack.toFixed(8)),
          qtyMgPerTablet: qtyMg,
          note: r.note || (parseQty(r.qty) == null ? 'оценка (в источнике не указано)' : ''),
          componentType: r.type,
        };
      });

    specifications.push({
      id: uid(),
      name: materialsByName.get([...materialsByName.values()].find((m) => m.id === productId).name)?.name || key,
      productMaterialId: productId,
      batchSizeUnits: 25000,
      lines,
      source: 'recipes_raw',
    });
  }

  // fix spec names
  const mats = [...materialsByName.values()];
  for (const spec of specifications) {
    const p = mats.find((m) => m.id === spec.productMaterialId);
    spec.name = `Спецификация: ${p.name}`;
  }

  return { materials: mats, specifications, products: mats.filter((m) => m.type === 'продукт') };
}

function buildCounterparties(componentMaterials) {
  const used = new Map(); // materialId -> counterparty ids
  const counterparties = [];
  const byName = new Map();

  const ensureCp = (name) => {
    if (byName.has(name)) return byName.get(name);
    const c = { id: uid(), name };
    byName.set(name, c);
    counterparties.push(c);
    return c;
  };

  for (const mat of componentMaterials) {
    const n = rnd(1, 3);
    const names = [...COUNTERPARTY_POOL].sort(() => Math.random() - 0.5).slice(0, n);
    used.set(
      mat.id,
      names.map((name) => ensureCp(name).id)
    );
  }
  return { counterparties, materialCounterparties: used };
}

function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function buildLotsAndStock(componentMaterials, materialCounterparties, products, monthStart) {
  const lots = [];
  const stock = [];

  for (const mat of componentMaterials) {
    const cps = materialCounterparties.get(mat.id) || [];
    const lotCount = rnd(2, 5);
    for (let i = 0; i < lotCount; i++) {
      const cpId = cps[i % cps.length];
      const prodDate = new Date(monthStart);
      prodDate.setMonth(prodDate.getMonth() - rnd(1, 10));
      const expDate = addMonths(prodDate, rnd(18, 36));
      const lot = {
        id: uid(),
        number: `ПТ-${mat.name.slice(0, 3).toUpperCase().replace(/[^A-ZА-Я0-9]/gi, '')}-${String(i + 1).padStart(3, '0')}-${rnd(100, 999)}`,
        materialId: mat.id,
        counterpartyId: cpId,
        productionDate: isoDate(prodDate),
        expiryDate: isoDate(expDate),
      };
      lots.push(lot);
      // крупные партии: покрытие ~месяца при правиле «1 партия на компонент»
      const base = mat.type === 'основной компонент' ? rnd(400, 900) : rnd(600, 1400);
      const qty = Number((base + Math.random() * 100).toFixed(3));
      stock.push({
        id: uid(),
        materialId: mat.id,
        lotId: lot.id,
        quantity: qty,
      });
    }
  }

  // небольшие остатки ГП
  for (const p of products.slice(0, 8)) {
    const prodDate = new Date(monthStart);
    prodDate.setDate(prodDate.getDate() - rnd(5, 40));
    const lot = {
      id: uid(),
      number: `ГП-${rnd(10000, 99999)}`,
      materialId: p.id,
      counterpartyId: null,
      productionDate: isoDate(prodDate),
      expiryDate: isoDate(addMonths(prodDate, 24)),
    };
    lots.push(lot);
    stock.push({ id: uid(), materialId: p.id, lotId: lot.id, quantity: rnd(500, 5000) });
  }

  return { lots, stock };
}

function buildWorkCenters() {
  return [
    { id: uid(), name: 'Линия №1' },
    { id: uid(), name: 'Линия №2' },
  ];
}

function buildOrdersAndSeries(products, workCenters, monthStart, days = 30) {
  const series = [];
  const orders = [];
  let seriesSeq = 1;

  for (let day = 0; day < days; day++) {
    const dayDate = new Date(monthStart);
    dayDate.setDate(dayDate.getDate() + day);
    if (dayDate.getDay() === 0) continue; // воскресенье — выходной

    for (const wc of workCenters) {
      const seriesPerDay = rnd(1, 2);
      let hour = 8;
      for (let s = 0; s < seriesPerDay; s++) {
        const product = pick(products);
        const durationHours = seriesPerDay === 1 ? 10 : 5;
        const start = new Date(dayDate);
        start.setHours(hour, 0, 0, 0);
        const end = new Date(start);
        end.setHours(start.getHours() + durationHours);

        const ser = {
          id: uid(),
          number: `СЕР-${dayDate.getFullYear()}${String(dayDate.getMonth() + 1).padStart(2, '0')}-${String(seriesSeq++).padStart(4, '0')}`,
          materialId: product.id,
        };
        series.push(ser);

        const qty = seriesPerDay === 1 ? 25000 : rnd(12000, 13000);

        orders.push({
          id: uid(),
          materialId: product.id,
          seriesId: ser.id,
          workCenterId: wc.id,
          startAt: start.toISOString(),
          endAt: end.toISOString(),
          quantity: qty,
          status: 'новый',
          lines: [],
          specificationId: null,
        });

        hour += durationHours;
      }
    }
  }

  return { series, orders };
}

function linkSpecs(orders, specifications) {
  for (const o of orders) {
    const spec = specifications.find((s) => s.productMaterialId === o.materialId);
    o.specificationId = spec?.id || null;
  }
}

function main() {
  fs.mkdirSync(dataDir, { recursive: true });

  const monthStart = new Date('2026-08-01T00:00:00');
  const { materials, specifications, products } = buildMaterialsAndSpecs();
  const components = materials.filter((m) => m.type !== 'продукт');
  const { counterparties, materialCounterparties } = buildCounterparties(components);
  const { lots, stock } = buildLotsAndStock(components, materialCounterparties, products, monthStart);
  const workCenters = buildWorkCenters();
  const { series, orders } = buildOrdersAndSeries(products, workCenters, monthStart, 31);
  linkSpecs(orders, specifications);

  const payload = {
    materials,
    specifications,
    counterparties,
    lots,
    series,
    stock,
    reservations: [],
    work_centers: workCenters,
    production_orders: orders,
    material_movements: [],
  };

  for (const [name, rows] of Object.entries(payload)) {
    fs.writeFileSync(path.join(dataDir, `${name}.json`), JSON.stringify(rows, null, 2), 'utf8');
  }

  console.log('Seed OK');
  console.log({
    materials: materials.length,
    specifications: specifications.length,
    counterparties: counterparties.length,
    lots: lots.length,
    stock: stock.length,
    series: series.length,
    production_orders: orders.length,
    work_centers: workCenters.length,
  });
}

main();
