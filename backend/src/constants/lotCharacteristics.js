/** Системные коды пересчёта assay_and_dry. Не удалять, не менять code. */
export const PARAM_ASSAY = 'assay';
export const PARAM_DRY = 'loss_on_drying';
/** Старый код «сухое вещество» — миграция в loss_on_drying с инверсией значения. */
export const LEGACY_PARAM_DRY = 'dry_substance';

export const CHAR_KIND = {
  system: 'system',
  user: 'user',
};

export const MATERIAL_TYPES = [
  'продукт',
  'полуфабрикат',
  'основной компонент',
  'вспомогательный компонент',
];

export const CHARACTERISTIC_MANAGEMENT_TYPE = {
  id: 'lot_characteristic_management',
  code: 'LCH',
  label: 'Управление характеристиками',
  collection: 'characteristic_documents',
};

export const CHARACTERISTIC_DOCUMENT_STATUS = {
  draft: 'Создан',
  posted: 'Проведён',
  cancelled: 'Отменён',
};

export const RECALC_METHOD_ASSAY_DRY = 'assay_and_dry';
export const RECALC_METHOD_LABEL = 'Содержание и потеря при высушивании';
/** Короткая подпись в таблице спецификации. ПМПВ — потеря массы при высушивании. */
export const RECALC_METHOD_SHORT = 'Содерж. / ПМПВ';

export const SYSTEM_LOT_CHARACTERISTICS = [
  {
    id: 'lch-assay',
    code: PARAM_ASSAY,
    name: 'Количественное содержание',
    kind: CHAR_KIND.system,
    unit: '%',
    valueType: 'number',
    min: 0,
    max: 200,
    required: false,
    active: true,
    materialIds: [],
    materialTypes: [],
    comment: 'По аналитическому листу / COA. В формуле — фактическое содержание, %.',
  },
  {
    id: 'lch-dry',
    code: PARAM_DRY,
    name: 'Потеря массы при высушивании',
    kind: CHAR_KIND.system,
    unit: '%',
    valueType: 'number',
    min: 0,
    max: 100,
    required: false,
    active: true,
    materialIds: [],
    materialTypes: [],
    comment:
      'LOD / потеря массы при высушивании, %. В формуле используется как (100 − значение). Не путать с сухим остатком.',
  },
];

export function characteristicApplies(def, material) {
  if (!def || def.active === false || !material) return false;
  const ids = Array.isArray(def.materialIds) ? def.materialIds : [];
  const types = Array.isArray(def.materialTypes) ? def.materialTypes : [];
  if (!ids.length && !types.length) return false;
  if (ids.includes(material.id)) return true;
  if (material.type && types.includes(material.type)) return true;
  return false;
}

export function isSystemRecalcCode(code) {
  return code === PARAM_ASSAY || code === PARAM_DRY || code === LEGACY_PARAM_DRY;
}

/** Какие системные коэффициенты входят в формулу для материала (по применению). */
export function appliedRecalcTerms(material, defs = []) {
  const terms = { useAssay: false, useLod: false };
  if (!material) return terms;
  for (const def of defs) {
    if (def?.kind !== CHAR_KIND.system || !characteristicApplies(def, material)) continue;
    if (def.code === PARAM_ASSAY) terms.useAssay = true;
    if (def.code === PARAM_DRY || def.code === LEGACY_PARAM_DRY) terms.useLod = true;
  }
  return terms;
}

/** Пересчёт доступен, если к материалу применена хотя бы одна системная характеристика формулы. */
export function materialHasAssayDryApplication(material, defs = []) {
  const terms = appliedRecalcTerms(material, defs);
  return terms.useAssay || terms.useLod;
}

export function recalcMissingMessage(missingCodes = []) {
  const hasAssay = missingCodes.includes(PARAM_ASSAY);
  const hasLod = missingCodes.includes(PARAM_DRY) || missingCodes.includes(LEGACY_PARAM_DRY);
  if (hasAssay && hasLod) {
    return 'Нет количественного содержания и потери массы при высушивании в регистре — расход по эталону спецификации';
  }
  if (hasAssay) {
    return 'Нет количественного содержания в регистре — в формулу подставлен эталон спецификации';
  }
  if (hasLod) {
    return 'Нет потери массы при высушивании в регистре — в формулу подставлено 0 %';
  }
  return '';
}
