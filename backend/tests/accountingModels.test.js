import fs from 'fs';
import os from 'os';
import path from 'path';
import { after, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vilar-am-'));
process.env.VILAR_SQLITE_PATH = path.join(tmp, 'test.sqlite');
process.env.VILAR_SKIP_JSON_IMPORT = '1';

const store = await import('../src/store.js');
const planning = await import('../src/services/planning.js');
const accounting = await import('../src/services/accountingModels.js');

function isoDays(offset) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

describe('модели учёта и FEFO sequence', () => {
  beforeEach(() => {
    store.resetDatabase();
    store.ensureCollections();
  });

  after(() => {
    store.closeDb();
  });

  test('сиды Стандартная и Внутреннее производство', () => {
    const models = store.readAll('accounting_models');
    assert.ok(models.some((m) => m.id === accounting.MODEL_STANDARD_ID && m.name === 'Стандартная'));
    const internal = models.find((m) => m.id === accounting.MODEL_INTERNAL_ID);
    assert.equal(internal.name, 'Внутреннее производство');
    assert.equal(internal.ownProduction, true);
    assert.equal(internal.parseMode, 'fill');
  });

  test('новый материал получает Стандартную модель', () => {
    const mat = store.create('materials', {
      id: 'mat-1',
      name: 'Стеарат',
      type: 'вспомогательный компонент',
      unit: 'кг',
    });
    accounting.normalizeMaterialAccounting(mat);
    assert.equal(mat.accountingModelId, accounting.MODEL_STANDARD_ID);
  });

  test('FEFO при одном сроке берёт меньшую загрузку', () => {
    store.create('materials', {
      id: 'mat-api',
      name: 'Субстанция',
      type: 'основной компонент',
      unit: 'кг',
      accountingModelId: accounting.MODEL_INTERNAL_ID,
    });
    const expiry = isoDays(365);
    const prod = isoDays(-30);
    store.create('lots', {
      id: 'lot-91',
      number: '910726',
      materialId: 'mat-api',
      counterpartyId: null,
      manufacturerId: null,
      productionDate: prod,
      expiryDate: expiry,
    });
    store.create('lots', {
      id: 'lot-90',
      number: '900726',
      materialId: 'mat-api',
      counterpartyId: null,
      manufacturerId: null,
      productionDate: prod,
      expiryDate: expiry,
    });
    store.create('lots', {
      id: 'lot-100',
      number: '1000726',
      materialId: 'mat-api',
      counterpartyId: null,
      manufacturerId: null,
      productionDate: prod,
      expiryDate: expiry,
    });
    store.create('stock', {
      id: 'st-90',
      materialId: 'mat-api',
      lotId: 'lot-90',
      warehouseId: 'wh-components',
      quantity: 100,
    });
    store.create('stock', {
      id: 'st-91',
      materialId: 'mat-api',
      lotId: 'lot-91',
      warehouseId: 'wh-components',
      quantity: 100,
    });
    store.create('stock', {
      id: 'st-100',
      materialId: 'mat-api',
      lotId: 'lot-100',
      warehouseId: 'wh-components',
      quantity: 100,
    });

    accounting.backfillLotSequences('mat-api');
    const ordered = planning.availableLotsForMaterial('mat-api', 'FEFO').map((l) => l.number);
    assert.deepEqual(ordered, ['900726', '910726', '1000726']);
  });

  test('закупной CAST не получает sequence по заводской маске', () => {
    store.create('materials', {
      id: 'mat-buy',
      name: 'Стеарат',
      type: 'вспомогательный компонент',
      unit: 'кг',
      accountingModelId: accounting.MODEL_STANDARD_ID,
    });
    const lot = {
      id: 'lot-cast',
      number: 'CAST4P2001',
      materialId: 'mat-buy',
      productionDate: isoDays(-10),
      expiryDate: isoDays(200),
    };
    accounting.applyLotSequence(lot);
    assert.equal(lot.productionSequence, null);
  });
});
