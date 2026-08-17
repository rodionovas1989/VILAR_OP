import { LotCharacteristic } from '../types';

export const PARAM_ASSAY = 'assay';
export const PARAM_DRY = 'loss_on_drying';
export const LEGACY_PARAM_DRY = 'dry_substance';
export const RECALC_METHOD_LABEL = 'Содержание и потеря при высушивании';
/** Короткая подпись в таблице спецификации. ПМПВ — потеря массы при высушивании. */
export const RECALC_METHOD_SHORT = 'Содерж. / ПМПВ';

export const MATERIAL_TYPES = [
  'продукт',
  'полуфабрикат',
  'основной компонент',
  'вспомогательный компонент',
];

export function characteristicApplies(
  def: LotCharacteristic,
  material: { id: string; type?: string } | null | undefined
): boolean {
  if (!def || def.active === false || !material) return false;
  const ids = def.materialIds || [];
  const types = def.materialTypes || [];
  if (!ids.length && !types.length) return false;
  if (ids.includes(material.id)) return true;
  if (material.type && types.includes(material.type)) return true;
  return false;
}

export function appliedRecalcTerms(
  material: { id: string; type?: string } | null | undefined,
  defs: LotCharacteristic[] = []
): { useAssay: boolean; useLod: boolean } {
  const terms = { useAssay: false, useLod: false };
  if (!material) return terms;
  for (const def of defs) {
    if (def.kind !== 'system' || !characteristicApplies(def, material)) continue;
    if (def.code === PARAM_ASSAY) terms.useAssay = true;
    if (def.code === PARAM_DRY || def.code === LEGACY_PARAM_DRY) terms.useLod = true;
  }
  return terms;
}

export function materialHasAssayDryApplication(
  material: { id: string; type?: string } | null | undefined,
  defs: LotCharacteristic[] = []
): boolean {
  const terms = appliedRecalcTerms(material, defs);
  return terms.useAssay || terms.useLod;
}

export function recalcMissingMessage(missingCodes: string[] = []): string {
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

export function applicationSummary(def: LotCharacteristic, materials: { id: string; name: string }[]): string {
  const ids = def.materialIds || [];
  const types = def.materialTypes || [];
  if (!ids.length && !types.length) return 'не назначено';
  const parts: string[] = [];
  if (types.length) parts.push(types.join(', '));
  if (ids.length) {
    const names = ids.map((id) => materials.find((m) => m.id === id)?.name || id);
    parts.push(ids.length <= 2 ? names.join(', ') : `${ids.length} материала`);
  }
  return parts.join('; ');
}
