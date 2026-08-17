import fs from 'fs';
import os from 'os';
import path from 'path';
import { after, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vilar-sub-'));
process.env.VILAR_SQLITE_PATH = path.join(tmp, 'test.sqlite');
process.env.VILAR_SKIP_JSON_IMPORT = '1';
process.env.VILAR_ADMIN_PASSWORD = 'TestAdmin1!';

const store = await import('../src/store.js');
const documents = await import('../src/services/documents.js');
const planning = await import('../src/services/planning.js');

const USER = 'user-admin';
const WH_C = 'wh-components';

function isoDays(offset) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

function seedWorld() {
  store.resetDatabase();
  store.ensureCollections();

  store.create('materials', { id: 'mat-rm', name: 'Сырьё А', type: 'основной компонент', unit: 'кг' });
  store.create('materials', { id: 'mat-alt', name: 'Сырьё А аналог', type: 'основной компонент', unit: 'кг' });
  store.create('materials', { id: 'mat-other', name: 'Чужой', type: 'вспомогательный компонент', unit: 'кг' });
  store.create('materials', { id: 'mat-gp', name: 'Препарат', type: 'продукт', unit: 'уп' });
  store.create('counterparties', { id: 'cp-1', name: 'Поставщик' });
  store.create('lots', {
    id: 'lot-rm',
    number: 'RM-001',
    materialId: 'mat-rm',
    counterpartyId: 'cp-1',
    productionDate: isoDays(-30),
    expiryDate: isoDays(365),
  });
  store.create('lots', {
    id: 'lot-alt',
    number: 'ALT-001',
    materialId: 'mat-alt',
    counterpartyId: 'cp-1',
    productionDate: isoDays(-20),
    expiryDate: isoDays(300),
  });
  store.create('series', { id: 'ser-1', number: 'S-001', materialId: 'mat-gp' });
  store.create('work_centers', { id: 'wc-1', name: 'Линия 1' });
  store.create('tech_maps', { id: 'tm-1', name: 'Техкарта линия 1', workCenterId: 'wc-1' });
  store.create('specifications', {
    id: 'spec-1',
    name: 'Спец препарат',
    type: 'Основная',
    productMaterialId: 'mat-gp',
    techMapId: 'tm-1',
    qtyBasis: 'per1000',
    lines: [{ id: 'sl-1', materialId: 'mat-rm', qtyPerUnit: 2 }],
    approvedSuppliers: [],
  });
  store.create('substitutions', {
    id: 'sub-1',
    name: 'Аналоги сырья А',
    baseMaterialId: 'mat-rm',
    bidirectional: true,
    active: true,
    specificationId: null,
    lines: [{ materialId: 'mat-alt', factor: 1, priority: 1 }],
  });
  store.create('production_orders', {
    id: 'ord-1',
    materialId: 'mat-gp',
    seriesId: 'ser-1',
    specificationId: 'spec-1',
    workCenterId: 'wc-1',
    quantity: 1000,
    status: 'новый',
    startAt: `${isoDays(0)}T08:00:00.000Z`,
    endAt: `${isoDays(1)}T08:00:00.000Z`,
    lines: [],
    actualLines: [],
  });
}

beforeEach(() => {
  seedWorld();
});

after(() => {
  store.closeDb();
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('Подбор с аналогами', () => {
  test('если нет партии базового материала — берёт аналог', () => {
    const draft = documents.createDocument('receipt', {
      createdByUserId: USER,
      warehouseToId: WH_C,
      lines: [{ materialId: 'mat-alt', lotId: 'lot-alt', quantity: 50 }],
    });
    documents.postDocument('receipt', draft.id, USER);

    const { picks } = planning.suggestPicksForOrder('ord-1', 'FEFO');
    assert.equal(picks.length, 1);
    assert.equal(picks[0].specMaterialId, 'mat-rm');
    assert.equal(picks[0].materialId, 'mat-alt');
    assert.equal(picks[0].substituted, true);
    assert.equal(picks[0].ok, true);
    assert.equal(picks[0].lotId, 'lot-alt');
    assert.ok(picks[0].allowedMaterialIds.includes('mat-rm'));
    assert.ok(picks[0].allowedMaterialIds.includes('mat-alt'));
  });

  test('подтверждение аналога проходит, чужой материал — нет', () => {
    const draft = documents.createDocument('receipt', {
      createdByUserId: USER,
      warehouseToId: WH_C,
      lines: [{ materialId: 'mat-alt', lotId: 'lot-alt', quantity: 50 }],
    });
    documents.postDocument('receipt', draft.id, USER);

    const ok = planning.confirmMaterialPicks(
      'ord-1',
      [{ specLineId: 'sl-1', specMaterialId: 'mat-rm', materialId: 'mat-alt', lotId: 'lot-alt', quantity: 2 }],
      USER
    );
    assert.equal(ok.order.status, 'спланирован');
    assert.equal(ok.order.lines[0].materialId, 'mat-alt');
    assert.equal(ok.order.lines[0].specMaterialId, 'mat-rm');

    store.update('production_orders', 'ord-1', { status: 'новый', lines: [], actualLines: [] });
    assert.throws(
      () =>
        planning.confirmMaterialPicks(
          'ord-1',
          [{ specLineId: 'sl-1', specMaterialId: 'mat-rm', materialId: 'mat-other', lotId: 'lot-alt', quantity: 2 }],
          USER
        ),
      /список аналогов/
    );
  });
});
