import * as store from '../store.js';
import {
  emptyTemplate,
  generateNumber,
  hasTokens,
  normalizeTemplate,
  parseNumber,
  plantLoadTemplate,
} from './numberTemplates.js';

export const MODEL_STANDARD_ID = 'am-standard';
export const MODEL_INTERNAL_ID = 'am-internal';

export const PARSE_MODES = ['none', 'fill', 'strict'];

export function standardModelSeed() {
  return {
    id: MODEL_STANDARD_ID,
    name: 'Стандартная',
    ownProduction: false,
    parseMode: 'none',
    generateOnRelease: false,
    mixSameManufacturer: false,
    lotNumberTemplate: emptyTemplate(),
  };
}

export function internalModelSeed() {
  return {
    id: MODEL_INTERNAL_ID,
    name: 'Внутреннее производство',
    ownProduction: true,
    parseMode: 'fill',
    generateOnRelease: true,
    mixSameManufacturer: false,
    lotNumberTemplate: plantLoadTemplate(),
  };
}

export function normalizeAccountingModel(raw) {
  const name = String(raw?.name || '').trim();
  if (!name) throw new Error('Укажите название модели учёта');
  const parseMode = PARSE_MODES.includes(raw?.parseMode) ? raw.parseMode : 'none';
  const ownProduction = raw?.ownProduction === true || raw?.ownProduction === 'true';
  const generateOnRelease = raw?.generateOnRelease === true || raw?.generateOnRelease === 'true';
  const mixSameManufacturer = raw?.mixSameManufacturer === true || raw?.mixSameManufacturer === 'true';
  const lotNumberTemplate = normalizeTemplate(raw?.lotNumberTemplate);
  if ((parseMode === 'strict' || generateOnRelease) && !hasTokens(lotNumberTemplate)) {
    throw new Error('Задайте шаблон номера или выключите строгую проверку / генерацию');
  }
  return {
    ...raw,
    name,
    ownProduction,
    parseMode,
    generateOnRelease,
    mixSameManufacturer,
    lotNumberTemplate,
  };
}

export function modelOfMaterial(material) {
  const id = material?.accountingModelId;
  if (!id) return null;
  return store.getById('accounting_models', id) || null;
}

export function mixSameManufacturerAllowed(materialId) {
  const material = store.getById('materials', materialId);
  return Boolean(modelOfMaterial(material)?.mixSameManufacturer);
}

function asSequence(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

/** Заполняет lot.productionSequence по модели материала. */
export function applyLotSequence(lot) {
  const material = store.getById('materials', lot.materialId);
  const model = modelOfMaterial(material);
  const parseMode = model?.parseMode || 'none';
  const template = model?.lotNumberTemplate;

  if (parseMode !== 'none' && hasTokens(template)) {
    const parsed = parseNumber(lot.number, template);
    if (parsed.ok && parsed.load != null) {
      lot.productionSequence = parsed.load;
      return lot;
    }
    if (parseMode === 'strict') {
      throw new Error(
        `Номер партии «${lot.number}» не соответствует шаблону модели учёта «${model.name}»`
      );
    }
  }

  lot.productionSequence = asSequence(lot.productionSequence);
  return lot;
}

export function parseByMaterial(material, number) {
  const model = modelOfMaterial(material);
  if (!model || model.parseMode === 'none' || !hasTokens(model.lotNumberTemplate)) {
    return { ok: false };
  }
  return parseNumber(number, model.lotNumberTemplate);
}

export function generateByMaterial(material, ctx) {
  const model = modelOfMaterial(material);
  if (!model?.generateOnRelease || !hasTokens(model.lotNumberTemplate)) {
    throw new Error('У модели учёта не включена генерация номера');
  }
  return generateNumber(ctx, model.lotNumberTemplate);
}

export function normalizeMaterialAccounting(item) {
  const id = String(item?.accountingModelId || '').trim();
  if (!id) {
    item.accountingModelId = MODEL_STANDARD_ID;
    return item;
  }
  if (!store.getById('accounting_models', id)) {
    throw new Error('Модель учёта не найдена');
  }
  item.accountingModelId = id;
  return item;
}

export function backfillLotSequences(materialId = null) {
  const lots = store.readAll('lots');
  let changed = false;
  for (const lot of lots) {
    if (materialId && lot.materialId !== materialId) continue;
    const before = lot.productionSequence ?? null;
    applyLotSequence(lot);
    if ((lot.productionSequence ?? null) !== before) {
      store.update('lots', lot.id, lot);
      changed = true;
    }
  }
  return changed;
}

export function ensureSeedAccountingModels() {
  let models = store.readAll('accounting_models');
  let changed = false;
  if (!models.some((m) => m.id === MODEL_STANDARD_ID)) {
    models.push(standardModelSeed());
    changed = true;
  }
  if (!models.some((m) => m.id === MODEL_INTERNAL_ID)) {
    models.push(internalModelSeed());
    changed = true;
  }
  for (const model of models) {
    if (model.mixSameManufacturer == null) {
      model.mixSameManufacturer = false;
      changed = true;
    }
  }
  if (changed) store.writeAll('accounting_models', models);

  const materials = store.readAll('materials');
  let matChanged = false;
  for (const mat of materials) {
    if (!mat.accountingModelId) {
      mat.accountingModelId = MODEL_STANDARD_ID;
      matChanged = true;
    }
  }
  if (matChanged) store.writeAll('materials', materials);

  backfillLotSequences();
}
