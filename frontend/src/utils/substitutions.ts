import { Substitution } from '../types';

function ruleApplies(rule: Substitution, specificationId: string | null | undefined): boolean {
  if (rule.active === false) return false;
  if (!rule.specificationId) return true;
  return Boolean(specificationId) && rule.specificationId === specificationId;
}

/** Прямые замены (как backend substitutesFor), без транзитивности. */
export function substitutesFor(
  rules: Substitution[],
  fromMaterialId: string,
  specificationId: string | null | undefined
): { materialId: string; ruleId: string }[] {
  if (!fromMaterialId) return [];
  const out: { materialId: string; ruleId: string; priority: number }[] = [];
  const seen = new Set<string>();

  const add = (materialId: string, ruleId: string, priority: number) => {
    if (!materialId || materialId === fromMaterialId || seen.has(materialId)) return;
    seen.add(materialId);
    out.push({ materialId, ruleId, priority });
  };

  for (const rule of rules) {
    if (!ruleApplies(rule, specificationId)) continue;
    const lines = Array.isArray(rule.lines) ? rule.lines : [];
    if (rule.baseMaterialId === fromMaterialId) {
      lines.forEach((line, idx) => {
        add(line.materialId, rule.id, Number(line.priority) || idx + 1);
      });
    } else if (rule.bidirectional !== false) {
      const hit = lines.find((l) => l.materialId === fromMaterialId);
      if (hit) {
        add(rule.baseMaterialId, rule.id, Number(hit.priority) || 1);
      }
    }
  }

  out.sort((a, b) => a.priority - b.priority || a.materialId.localeCompare(b.materialId));
  return out.map(({ materialId, ruleId }) => ({ materialId, ruleId }));
}

/** Материал входит в список аналогов компонентов рецептуры (не сам компонент). */
export function isSpecAnalogueMaterial(
  rules: Substitution[],
  materialId: string,
  componentIds: string[],
  specificationId: string | null | undefined
): boolean {
  if (!materialId || componentIds.includes(materialId)) return false;
  return componentIds.some((baseId) =>
    substitutesFor(rules, baseId, specificationId).some((s) => s.materialId === materialId)
  );
}
