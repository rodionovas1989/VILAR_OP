import test from 'node:test';
import assert from 'node:assert/strict';
import { scenarioMatchesLot, normalizeScenario, SCENARIO_TYPE_LOT_REGISTERED } from '../src/services/scenarios.js';

test('scenarioMatchesLot: empty selected = nobody', () => {
  const scenario = {
    enabled: true,
    type: SCENARIO_TYPE_LOT_REGISTERED,
    materialScope: 'selected',
    materialIds: [],
    counterpartyScope: 'all',
    counterpartyIds: [],
  };
  assert.equal(
    scenarioMatchesLot(scenario, { id: 'l1', materialId: 'm1', counterpartyId: 'c1' }),
    false
  );
});

test('scenarioMatchesLot: all+all matches any lot with material', () => {
  const scenario = {
    enabled: true,
    type: SCENARIO_TYPE_LOT_REGISTERED,
    materialScope: 'all',
    materialIds: [],
    counterpartyScope: 'all',
    counterpartyIds: [],
  };
  assert.equal(
    scenarioMatchesLot(scenario, { id: 'l1', materialId: 'm1', counterpartyId: null }),
    true
  );
});

test('scenarioMatchesLot: selected material and counterparty', () => {
  const scenario = {
    enabled: true,
    type: SCENARIO_TYPE_LOT_REGISTERED,
    materialScope: 'selected',
    materialIds: ['m1'],
    counterpartyScope: 'selected',
    counterpartyIds: ['c1'],
  };
  assert.equal(
    scenarioMatchesLot(scenario, { id: 'l1', materialId: 'm1', counterpartyId: 'c1' }),
    true
  );
  assert.equal(
    scenarioMatchesLot(scenario, { id: 'l2', materialId: 'm1', counterpartyId: 'c2' }),
    false
  );
  assert.equal(
    scenarioMatchesLot(scenario, { id: 'l3', materialId: 'm1', counterpartyId: null }),
    false
  );
});

test('normalizeScenario requires name and qualityId', () => {
  assert.throws(() => normalizeScenario({ materialScope: 'all', counterpartyScope: 'all' }), /название/i);
});
