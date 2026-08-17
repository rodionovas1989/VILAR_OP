import {
  PARAM_ASSAY,
  PARAM_DRY,
  LEGACY_PARAM_DRY,
  appliedRecalcTerms,
  materialHasAssayDryApplication,
} from '../constants/lotCharacteristics.js';
import { getLotCharacteristicMap, listCharacteristics } from './characteristics.js';
import * as store from '../store.js';

function round6(n) {
  return Number(Number(n).toFixed(6));
}

function asPositive(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function asFinite(value) {
  if (value === '' || value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function normalizeParamValues(raw) {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const out = {};
  for (const [code, value] of Object.entries(src)) {
    if (value === '' || value == null) continue;
    const n = Number(value);
    if (!Number.isFinite(n)) continue;
    out[String(code)] = n;
  }
  return out;
}

function valuesFromLot(lot) {
  if (!lot) return {};
  if (lot.characteristicValues && typeof lot.characteristicValues === 'object') {
    return lot.characteristicValues;
  }
  if (lot.id) return getLotCharacteristicMap(lot.id);
  return {};
}

function pickValue(values, ...codes) {
  for (const code of codes) {
    const n = asFinite(values?.[code]);
    if (n != null) return n;
  }
  return null;
}

function lineUsesAssayDry(line) {
  if (line?.recalcMethod !== 'assay_and_dry') return false;
  if (!line.materialId) return true;
  const material = store.getById('materials', line.materialId);
  return materialHasAssayDryApplication(material, listCharacteristics());
}

function recalcTermsForLine(line) {
  if (!line?.materialId) return { useAssay: true, useLod: true };
  const material = store.getById('materials', line.materialId);
  return appliedRecalcTerms(material, listCharacteristics());
}

/**
 * Потребность по строке спеки.
 * Коэффициенты только из применения материала.
 * Содержание: × эталон / факт (нет факта → эталон).
 * Потеря при высушивании: × 100 / (100 − LOD) (нет факта → LOD = 0).
 */
export function computeLineNeed(line, orderQty, lot) {
  const nominal = round6((Number(line?.qtyPerUnit) * Number(orderQty)) / 1000);
  const method = lineUsesAssayDry(line) ? 'assay_and_dry' : 'none';
  if (method !== 'assay_and_dry') {
    return {
      quantity: nominal,
      nominal,
      applied: false,
      missing: false,
      missingCodes: [],
      method,
      useAssay: false,
      useLod: false,
      snapshot: null,
    };
  }
  const terms = recalcTermsForLine(line);
  const xLabel = asPositive(line.recalcXLabel) || 100;
  const values = valuesFromLot(lot);
  const assayFact = asPositive(pickValue(values, PARAM_ASSAY));
  const lodRaw = pickValue(values, PARAM_DRY, LEGACY_PARAM_DRY);
  const lodValid = lodRaw != null && lodRaw >= 0 && lodRaw < 100;
  const lodFact = lodValid ? lodRaw : null;

  const missingCodes = [];
  let factor = 1;
  if (terms.useAssay) {
    if (assayFact == null) missingCodes.push(PARAM_ASSAY);
    const assay = assayFact || xLabel;
    factor *= xLabel / assay;
  }
  if (terms.useLod) {
    if (lodFact == null) missingCodes.push(PARAM_DRY);
    const lod = lodFact == null ? 0 : lodFact;
    factor *= 100 / (100 - lod);
  }

  return {
    quantity: round6(nominal * factor),
    nominal,
    applied: missingCodes.length === 0 && (terms.useAssay || terms.useLod),
    missing: missingCodes.length > 0,
    missingCodes,
    method,
    useAssay: terms.useAssay,
    useLod: terms.useLod,
    snapshot: {
      xLabel,
      assay: assayFact,
      lossOnDrying: lodFact,
    },
  };
}
