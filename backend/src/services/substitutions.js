import * as store from '../store.js';

function asFactor(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function asPriority(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function normalizeSubstitution(item) {
  const out = { ...item };
  out.name = String(out.name || '').trim();
  out.baseMaterialId = out.baseMaterialId || null;
  out.bidirectional = out.bidirectional !== false;
  out.active = out.active !== false;
  out.specificationId = out.specificationId || null;
  if (!out.baseMaterialId) throw new Error('Укажите базовый материал');
  if (!store.getById('materials', out.baseMaterialId)) throw new Error('Базовый материал не найден');
  if (out.specificationId && !store.getById('specifications', out.specificationId)) {
    throw new Error('Спецификация не найдена');
  }
  const rawLines = Array.isArray(out.lines) ? out.lines : [];
  const lines = [];
  const seen = new Set();
  rawLines.forEach((line, idx) => {
    const materialId = line?.materialId || null;
    if (!materialId) return;
    if (materialId === out.baseMaterialId) {
      throw new Error('Аналог не может совпадать с базовым материалом');
    }
    if (!store.getById('materials', materialId)) throw new Error('Материал-аналог не найден');
    if (seen.has(materialId)) throw new Error('Один материал не может повторяться в списке аналогов');
    seen.add(materialId);
    lines.push({
      materialId,
      factor: asFactor(line.factor),
      priority: asPriority(line.priority, idx + 1),
    });
  });
  if (!lines.length) throw new Error('Укажите хотя бы один аналог');
  out.lines = lines;
  if (!out.name) {
    const base = store.getById('materials', out.baseMaterialId);
    out.name = `Аналоги: ${base?.name || out.baseMaterialId}`;
  }
  return out;
}

function ruleApplies(rule, specificationId) {
  if (rule.active === false) return false;
  if (!rule.specificationId) return true;
  return rule.specificationId === specificationId;
}

/**
 * Прямые замены материала (без транзитивности).
 * Базовый → аналоги; при bidirectional каждый аналог → базовый (не друг в друга).
 */
export function substitutesFor(fromMaterialId, specificationId = null) {
  if (!fromMaterialId) return [];
  const out = [];
  const seen = new Set();

  const add = (materialId, ruleId, factor, priority) => {
    if (!materialId || materialId === fromMaterialId || seen.has(materialId)) return;
    if (!store.getById('materials', materialId)) return;
    seen.add(materialId);
    out.push({
      materialId,
      ruleId,
      factor: asFactor(factor),
      priority: asPriority(priority, out.length + 1),
    });
  };

  for (const rule of store.readAll('substitutions')) {
    if (!ruleApplies(rule, specificationId)) continue;
    const lines = Array.isArray(rule.lines) ? rule.lines : [];
    if (rule.baseMaterialId === fromMaterialId) {
      for (const line of lines) {
        add(line.materialId, rule.id, line.factor, line.priority);
      }
    } else if (rule.bidirectional !== false) {
      const hit = lines.find((l) => l.materialId === fromMaterialId);
      if (hit) {
        const reverseFactor = asFactor(hit.factor) ? 1 / asFactor(hit.factor) : 1;
        add(rule.baseMaterialId, rule.id, reverseFactor, hit.priority);
      }
    }
  }

  out.sort((a, b) => a.priority - b.priority || String(a.materialId).localeCompare(String(b.materialId)));
  return out;
}

export function candidateMaterials(fromMaterialId, specificationId = null) {
  const primary = { materialId: fromMaterialId, ruleId: null, factor: 1, priority: 0 };
  return [primary, ...substitutesFor(fromMaterialId, specificationId)];
}

export function isAllowedSubstitute(fromMaterialId, toMaterialId, specificationId = null) {
  if (!fromMaterialId || !toMaterialId) return false;
  if (fromMaterialId === toMaterialId) return true;
  return substitutesFor(fromMaterialId, specificationId).some((s) => s.materialId === toMaterialId);
}

export function substitutionRuleId(fromMaterialId, toMaterialId, specificationId = null) {
  if (!fromMaterialId || !toMaterialId || fromMaterialId === toMaterialId) return null;
  return substitutesFor(fromMaterialId, specificationId).find((s) => s.materialId === toMaterialId)?.ruleId || null;
}
