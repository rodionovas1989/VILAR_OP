import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import * as store from '../store.js';
import { PARAM_ASSAY, PARAM_DRY, CHAR_KIND } from '../constants/lotCharacteristics.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RECIPES_PATH = path.join(__dirname, '..', '..', 'scripts', 'customer_recipes.json');

function uid() {
  return randomUUID();
}

function roundQty(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Number(x.toFixed(8));
}

export function recipesSourcePath() {
  return RECIPES_PATH;
}

export function loadRecipesFile() {
  if (!fs.existsSync(RECIPES_PATH)) {
    throw new Error(`Не найден файл рецептур: ${RECIPES_PATH}`);
  }
  return JSON.parse(fs.readFileSync(RECIPES_PATH, 'utf8'));
}

function applyAssayDryApplication(materialIds) {
  const extra = [...new Set((materialIds || []).filter(Boolean))];
  if (!extra.length) return;
  for (const row of store.readAll('lot_characteristics')) {
    if (row.kind !== CHAR_KIND.system) continue;
    if (row.code !== PARAM_ASSAY && row.code !== PARAM_DRY) continue;
    const materialIdsNext = [...new Set([...(row.materialIds || []), ...extra])];
    store.update('lot_characteristics', row.id, { ...row, materialIds: materialIdsNext });
  }
}

function ensureMaterial(byName, name, type, unit) {
  const key = String(name || '').trim();
  if (!key) throw new Error('Пустое имя материала');
  if (byName.has(key)) {
    const existing = byName.get(key);
    if (type === 'основной компонент' && existing.type === 'вспомогательный компонент') {
      existing.type = 'основной компонент';
    }
    return existing;
  }
  const mat = { id: uid(), name: key, type, unit };
  byName.set(key, mat);
  return mat;
}

/**
 * Заполняет справочники из customer_recipes.json.
 * Ожидает пустые материалы/спеки/РЦ (после очистки). Склады и пользователи не трогает.
 */
export function applyCustomerRecipes(raw) {
  const data = raw || loadRecipesFile();
  const products = Array.isArray(data.products) ? data.products : [];
  if (!products.length) throw new Error('В файле рецептур нет продуктов');

  const wc = store.create('work_centers', {
    id: 'wc-line-1',
    name: String(data.workCenterName || 'Линия №1').trim() || 'Линия №1',
  });
  const techMap = store.create('tech_maps', {
    id: 'tech-map-line-1',
    name: String(data.techMapName || 'Линия №1').trim() || 'Линия №1',
    workCenterId: wc.id,
  });

  const byName = new Map();
  for (const product of products) {
    ensureMaterial(byName, product.name, 'продукт', 'уп');
    for (const line of product.lines || []) {
      const type = line.componentType === 'Активный' ? 'основной компонент' : 'вспомогательный компонент';
      ensureMaterial(byName, line.material, type, 'кг');
    }
  }
  for (const sub of data.substitutions || []) {
    ensureMaterial(byName, sub.base, 'основной компонент', 'кг');
    for (const analog of sub.analogs || []) {
      ensureMaterial(byName, analog, 'основной компонент', 'кг');
    }
  }

  for (const mat of byName.values()) {
    store.create('materials', mat);
  }

  const specifications = [];
  const planned = [];
  const recalcMaterialIds = [];
  for (const product of products) {
    const gp = byName.get(String(product.name).trim());
    const lines = (product.lines || [])
      .filter((l) => l.material)
      .map((l) => {
        const mat = byName.get(String(l.material).trim());
        const recalcMethod = l.recalcMethod === 'assay_and_dry' ? 'assay_and_dry' : 'none';
        if (recalcMethod === 'assay_and_dry') recalcMaterialIds.push(mat.id);
        return {
          id: uid(),
          materialId: mat.id,
          qtyPerUnit: roundQty(l.qtyPerUnit),
          componentType: l.componentType === 'Активный' ? 'Активный' : 'Вспомогательный',
          recalcMethod,
          recalcXLabel: recalcMethod === 'assay_and_dry' ? Number(l.recalcXLabel) || 100 : null,
          recalcComment: l.recalcComment || '',
          recalcFormula: l.recalcFormula || '',
        };
      });
    const spec = store.create('specifications', {
      id: uid(),
      name: gp.name,
      productMaterialId: gp.id,
      type: 'Основная',
      techMapId: techMap.id,
      qtyBasis: 'per1000',
      lines,
      approvedSuppliers: [],
      source: 'customer_recipes',
    });
    specifications.push(spec);
    const seriesSize = Number(product.seriesSize);
    if (seriesSize > 0) {
      planned.push(
        store.create('planned_series_volumes', {
          id: uid(),
          materialId: gp.id,
          workCenterId: wc.id,
          quantity: seriesSize,
        })
      );
    }
  }

  const substitutions = [];
  for (const sub of data.substitutions || []) {
    const base = byName.get(String(sub.base).trim());
    const analogMats = (sub.analogs || [])
      .map((name) => byName.get(String(name).trim()))
      .filter(Boolean);
    if (!base || !analogMats.length) continue;
    substitutions.push(
      store.create('substitutions', {
        id: uid(),
        name: `Аналоги: ${base.name}`,
        baseMaterialId: base.id,
        bidirectional: sub.bidirectional !== false,
        active: true,
        specificationId: null,
        lines: analogMats.map((m, idx) => ({ materialId: m.id, factor: 1, priority: idx + 1 })),
      })
    );
  }

  applyAssayDryApplication(recalcMaterialIds);

  return {
    workCenterId: wc.id,
    techMapId: techMap.id,
    materials: byName.size,
    products: products.length,
    specifications: specifications.length,
    plannedSeriesVolumes: planned.length,
    substitutions: substitutions.length,
  };
}
