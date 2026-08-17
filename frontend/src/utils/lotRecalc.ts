import { PARAM_ASSAY, PARAM_DRY, LEGACY_PARAM_DRY } from './lotCharacteristics';

function asPositive(value: number | null | undefined): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function asFinite(value: number | null | undefined): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export { PARAM_ASSAY, PARAM_DRY };

export function computeLineNeed(opts: {
  qtyPerUnit: number;
  orderQty: number;
  recalcMethod?: string | null;
  recalcXLabel?: number | null;
  assay?: number | null;
  lossOnDrying?: number | null;
  drySubstance?: number | null;
  useAssay?: boolean;
  useLod?: boolean;
}): { quantity: number; nominal: number; applied: boolean; missing: boolean; missingCodes: string[] } {
  const nominal = Number(((Number(opts.qtyPerUnit) * Number(opts.orderQty)) / 1000).toFixed(6));
  if (opts.recalcMethod !== 'assay_and_dry') {
    return { quantity: nominal, nominal, applied: false, missing: false, missingCodes: [] };
  }
  const useAssay = opts.useAssay !== false;
  const useLod = opts.useLod !== false;
  const xLabel = asPositive(opts.recalcXLabel) ?? 100;
  const assayFact = asPositive(opts.assay);
  const lodRaw = asFinite(opts.lossOnDrying ?? opts.drySubstance);
  const lodFact = lodRaw != null && lodRaw >= 0 && lodRaw < 100 ? lodRaw : null;
  const missingCodes: string[] = [];
  let factor = 1;
  if (useAssay) {
    if (assayFact == null) missingCodes.push(PARAM_ASSAY);
    factor *= xLabel / (assayFact || xLabel);
  }
  if (useLod) {
    if (lodFact == null) missingCodes.push(PARAM_DRY);
    const lod = lodFact == null ? 0 : lodFact;
    factor *= 100 / (100 - lod);
  }
  return {
    quantity: Number((nominal * factor).toFixed(6)),
    nominal,
    applied: missingCodes.length === 0 && (useAssay || useLod),
    missing: missingCodes.length > 0,
    missingCodes,
  };
}

export function lotRecalcValue(
  values: Record<string, number> | undefined,
  ...codes: string[]
): number | null {
  if (!values) return null;
  for (const code of codes) {
    const n = asFinite(values[code]);
    if (n != null) return n;
  }
  return null;
}

export { LEGACY_PARAM_DRY };
