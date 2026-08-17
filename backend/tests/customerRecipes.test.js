import fs from 'fs';
import os from 'os';
import path from 'path';
import { after, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vilar-recipes-'));
process.env.VILAR_SQLITE_PATH = path.join(tmp, 'test.sqlite');
process.env.VILAR_SKIP_JSON_IMPORT = '1';
process.env.VILAR_ADMIN_PASSWORD = 'TestAdmin1!';

const store = await import('../src/store.js');
const { applyCustomerRecipes } = await import('../src/services/customerRecipes.js');
const substitutions = await import('../src/services/substitutions.js');

beforeEach(() => {
  store.resetDatabase();
  store.ensureCollections();
});

after(() => {
  store.closeDb();
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('Импорт рецептур заказчика', () => {
  test('создаёт 14 спецификаций, Линию №1, аналоги и объёмы', () => {
    const result = applyCustomerRecipes();
    assert.equal(result.products, 14);
    assert.equal(result.specifications, 14);
    assert.equal(result.substitutions, 2);
    assert.equal(store.readAll('work_centers').length, 1);
    assert.equal(store.readAll('work_centers')[0].name, 'Линия №1');
    assert.equal(store.readAll('tech_maps').length, 1);
    assert.equal(store.readAll('planned_series_volumes').length, 14);
    const specs = store.readAll('specifications');
    assert.ok(specs.every((s) => s.techMapId === 'tech-map-line-1'));
    assert.ok(specs.every((s) => (s.lines || []).every((l) => l.id && l.materialId)));
    const withRecalc = specs.flatMap((s) => s.lines || []).filter((l) => l.recalcMethod === 'assay_and_dry');
    assert.equal(withRecalc.length, 15);
    const giporamin = specs.find((s) => String(s.name).includes('Гипорамин'));
    const apiLine = (giporamin?.lines || []).find((l) => l.recalcMethod === 'assay_and_dry');
    assert.equal(apiLine?.recalcXLabel, 60);
    const assay = store.readAll('lot_characteristics').find((d) => d.code === 'assay');
    const dry = store.readAll('lot_characteristics').find((d) => d.code === 'loss_on_drying');
    assert.ok((assay?.materialIds || []).includes(apiLine.materialId));
    assert.ok((dry?.materialIds || []).includes(apiLine.materialId));
  });
});

describe('Правила аналогов', () => {
  test('двусторонняя замена 1:1 без транзитивности', () => {
    store.create('materials', { id: 'm-a', name: 'A', type: 'основной компонент', unit: 'кг' });
    store.create('materials', { id: 'm-b', name: 'B', type: 'основной компонент', unit: 'кг' });
    store.create('materials', { id: 'm-c', name: 'C', type: 'основной компонент', unit: 'кг' });
    store.create('substitutions', {
      id: 'sub-1',
      name: 'A↔B',
      baseMaterialId: 'm-a',
      bidirectional: true,
      active: true,
      specificationId: null,
      lines: [{ materialId: 'm-b', factor: 1, priority: 1 }],
    });
    const fromA = substitutions.substitutesFor('m-a');
    assert.deepEqual(fromA.map((x) => x.materialId), ['m-b']);
    const fromB = substitutions.substitutesFor('m-b');
    assert.deepEqual(fromB.map((x) => x.materialId), ['m-a']);
    assert.equal(substitutions.isAllowedSubstitute('m-a', 'm-c'), false);
    assert.equal(substitutions.isAllowedSubstitute('m-a', 'm-a'), true);
  });
});
