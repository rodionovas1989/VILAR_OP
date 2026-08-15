import * as store from '../store.js';
import { createQualityDocument, postQualityDocument } from './quality.js';

export const SCENARIO_TYPE_LOT_REGISTERED = 'lot_registered';

export const SCENARIO_TYPES = [
  { id: SCENARIO_TYPE_LOT_REGISTERED, label: 'Регистрация новых партий' },
];

const SCOPES = new Set(['all', 'selected']);

function asIdList(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((v) => String(v || '').trim()).filter(Boolean))];
}

function assertScope(value, field) {
  const scope = value === 'all' || value === 'selected' ? value : null;
  if (!scope || !SCOPES.has(scope)) {
    throw new Error(`${field}: укажите «все» или «выбранные»`);
  }
  return scope;
}

/** Нормализация и проверка тела сценария (create/update). */
export function normalizeScenario(raw, { partial = false } = {}) {
  const out = { ...raw };

  if (!partial || raw.name !== undefined) {
    out.name = String(raw.name || '').trim();
    if (!out.name) throw new Error('Укажите название сценария');
  }

  if (!partial || raw.type !== undefined) {
    out.type = raw.type || SCENARIO_TYPE_LOT_REGISTERED;
    if (!SCENARIO_TYPES.some((t) => t.id === out.type)) {
      throw new Error('Неизвестный тип сценария');
    }
  }

  if (!partial || raw.enabled !== undefined) {
    out.enabled = raw.enabled !== false && raw.enabled !== 'false';
  }

  if (!partial || raw.materialScope !== undefined) {
    out.materialScope = assertScope(raw.materialScope ?? 'selected', 'Материалы');
  }
  if (!partial || raw.materialIds !== undefined || raw.materialScope !== undefined) {
    out.materialIds = asIdList(raw.materialIds);
  }

  if (!partial || raw.counterpartyScope !== undefined) {
    out.counterpartyScope = assertScope(raw.counterpartyScope ?? 'selected', 'Контрагенты');
  }
  if (!partial || raw.counterpartyIds !== undefined || raw.counterpartyScope !== undefined) {
    out.counterpartyIds = asIdList(raw.counterpartyIds);
  }

  if (!partial || raw.qualityId !== undefined) {
    out.qualityId = String(raw.qualityId || '').trim();
    if (!out.qualityId) throw new Error('Укажите качество, которое назначит документ');
    const quality = store.getById('lot_qualities', out.qualityId);
    if (!quality || quality.active === false) {
      throw new Error('Качество не найдено или неактивно');
    }
  }

  if (!partial || raw.autoPost !== undefined) {
    out.autoPost = raw.autoPost !== false && raw.autoPost !== 'false';
  }

  if (!partial || raw.comment !== undefined) {
    out.comment = String(raw.comment || '').trim();
  }

  // Пустой selected = никто (матч не сработает) — сохранять можно, это явная настройка.
  return out;
}

function scopeMatches(scope, ids, value) {
  if (scope === 'all') return true;
  if (scope === 'selected') {
    if (!ids?.length) return false;
    if (value == null || value === '') return false;
    return ids.includes(value);
  }
  return false;
}

export function scenarioMatchesLot(scenario, lot) {
  if (!scenario?.enabled) return false;
  if (scenario.type !== SCENARIO_TYPE_LOT_REGISTERED) return false;
  if (!lot?.id) return false;
  const materialOk = scopeMatches(
    scenario.materialScope,
    scenario.materialIds,
    lot.materialId || null
  );
  const counterpartyOk = scopeMatches(
    scenario.counterpartyScope,
    scenario.counterpartyIds,
    lot.counterpartyId || null
  );
  return materialOk && counterpartyOk;
}

function registerExistsForLot(lotId) {
  return store.readAll('quality_register').some((r) => r.lotId === lotId);
}

/**
 * Синхронный хук после создания партии.
 * Если в регистре качеств уже есть запись — ничего не делаем (старые данные не трогаем).
 * Иначе для каждого подходящего включённого сценария создаём (и при autoPost проводим) QCM.
 * Несколько матчей → несколько документов; в регистре останется последний проведённый.
 */
export function onLotCreated(lot, userId) {
  if (!lot?.id || !userId) return [];
  if (!store.getById('users', userId)) {
    throw new Error('Не авторизован: нет пользователя для сценария качества');
  }
  if (registerExistsForLot(lot.id)) return [];

  const scenarios = store
    .readAll('quality_scenarios')
    .filter((s) => s.enabled && s.type === SCENARIO_TYPE_LOT_REGISTERED)
    .filter((s) => scenarioMatchesLot(s, lot));

  const created = [];
  for (const scenario of scenarios) {
    const quality = store.getById('lot_qualities', scenario.qualityId);
    if (!quality || quality.active === false) {
      throw new Error(
        `Сценарий «${scenario.name}»: качество не найдено или неактивно`
      );
    }
    const commentParts = [
      `Сценарий: ${scenario.name}`,
      scenario.comment || '',
    ].filter(Boolean);
    const draft = createQualityDocument({
      createdByUserId: userId,
      comment: commentParts.join('. '),
      lines: [
        {
          materialId: lot.materialId,
          lotId: lot.id,
          qualityId: scenario.qualityId,
        },
      ],
    });
    // Пометка источника (для аудита / отчётов)
    store.update('quality_documents', draft.id, {
      scenarioId: scenario.id,
      scenarioName: scenario.name,
    });
    const doc =
      scenario.autoPost === false
        ? store.getById('quality_documents', draft.id)
        : postQualityDocument(draft.id, userId);
    created.push(doc);
  }
  return created;
}

export function listScenarioTypes() {
  return SCENARIO_TYPES;
}
