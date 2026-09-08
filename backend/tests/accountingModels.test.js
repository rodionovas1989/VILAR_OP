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
    assert.equal(internal.mixSameManufacturer, false);
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

  test('смешение одного производителя: две партии на компонент', () => {
    store.update('accounting_models', accounting.MODEL_STANDARD_ID, { mixSameManufacturer: true });
    store.create('materials', {
      id: 'mat-mix',
      name: 'Стеарат',
      type: 'вспомогательный компонент',
      unit: 'кг',
      accountingModelId: accounting.MODEL_STANDARD_ID,
    });
    store.create('materials', {
      id: 'mat-gp-mix',
      name: 'Препарат',
      type: 'продукт',
      unit: 'уп',
    });
    store.create('manufacturers', { id: 'mfr-mix', name: 'Один завод' });
    store.create('lots', {
      id: 'lot-mix-a',
      number: 'A1',
      materialId: 'mat-mix',
      manufacturerId: 'mfr-mix',
      productionDate: isoDays(-20),
      expiryDate: isoDays(100),
    });
    store.create('lots', {
      id: 'lot-mix-b',
      number: 'A2',
      materialId: 'mat-mix',
      manufacturerId: 'mfr-mix',
      productionDate: isoDays(-10),
      expiryDate: isoDays(90),
    });
    store.create('stock', {
      id: 'st-mix-a',
      materialId: 'mat-mix',
      lotId: 'lot-mix-a',
      warehouseId: 'wh-components',
      quantity: 1,
    });
    store.create('stock', {
      id: 'st-mix-b',
      materialId: 'mat-mix',
      lotId: 'lot-mix-b',
      warehouseId: 'wh-components',
      quantity: 1,
    });
    store.create('series', { id: 'ser-mix', number: 'SM-1', materialId: 'mat-gp-mix' });
    store.create('work_centers', { id: 'wc-mix', name: 'Линия mix' });
    store.create('tech_maps', { id: 'tm-mix', name: 'ТК mix', workCenterId: 'wc-mix' });
    store.create('specifications', {
      id: 'spec-mix',
      name: 'Спека mix',
      type: 'Основная',
      productMaterialId: 'mat-gp-mix',
      techMapId: 'tm-mix',
      lines: [{ id: 'sl-mix', materialId: 'mat-mix', qtyPerUnit: 2 }],
    });
    store.create('production_orders', {
      id: 'ord-mix',
      materialId: 'mat-gp-mix',
      seriesId: 'ser-mix',
      specificationId: 'spec-mix',
      workCenterId: 'wc-mix',
      quantity: 1000,
      status: 'новый',
      startAt: `${isoDays(0)}T08:00:00.000Z`,
      endAt: `${isoDays(1)}T08:00:00.000Z`,
      lines: [],
      actualLines: [],
    });

    const { picks } = planning.suggestPicksForOrder('ord-mix', 'FEFO');
    assert.equal(picks.length, 2);
    assert.ok(picks.every((p) => p.ok));
    assert.deepEqual(
      picks.map((p) => p.lotId).sort(),
      ['lot-mix-a', 'lot-mix-b']
    );
    const sum = picks.reduce((s, p) => s + Number(p.quantity), 0);
    assert.equal(sum, 2);

    const confirmed = planning.confirmMaterialPicks(
      'ord-mix',
      picks.map((p) => ({
        specLineId: p.specLineId,
        materialId: p.materialId,
        lotId: p.lotId,
        warehouseId: p.warehouseId,
        quantity: p.quantity,
      })),
      'user-admin'
    );
    assert.equal(confirmed.order.lines.length, 2);
  });

  test('смешение не перескакивает FEFO-партию, если позже есть партия на весь need', () => {
    store.update('accounting_models', accounting.MODEL_STANDARD_ID, { mixSameManufacturer: true });
    store.create('materials', {
      id: 'mat-fefo-mix',
      name: 'Сахар',
      type: 'вспомогательный компонент',
      unit: 'кг',
      accountingModelId: accounting.MODEL_STANDARD_ID,
    });
    store.create('materials', { id: 'mat-gp-fm', name: 'ГП', type: 'продукт', unit: 'уп' });
    store.create('manufacturers', { id: 'mfr-fm', name: 'Завод' });
    store.create('lots', {
      id: 'lot-early',
      number: '267907',
      materialId: 'mat-fefo-mix',
      manufacturerId: 'mfr-fm',
      productionDate: isoDays(-5),
      expiryDate: isoDays(10),
    });
    store.create('lots', {
      id: 'lot-late',
      number: '257907',
      materialId: 'mat-fefo-mix',
      manufacturerId: 'mfr-fm',
      productionDate: isoDays(-400),
      expiryDate: isoDays(800),
    });
    store.create('stock', {
      id: 'st-early',
      materialId: 'mat-fefo-mix',
      lotId: 'lot-early',
      warehouseId: 'wh-components',
      quantity: 50,
    });
    store.create('stock', {
      id: 'st-late',
      materialId: 'mat-fefo-mix',
      lotId: 'lot-late',
      warehouseId: 'wh-components',
      quantity: 200,
    });
    store.create('series', { id: 'ser-fm', number: 'SF', materialId: 'mat-gp-fm' });
    store.create('work_centers', { id: 'wc-fm', name: 'Л' });
    store.create('tech_maps', { id: 'tm-fm', name: 'Т', workCenterId: 'wc-fm' });
    store.create('specifications', {
      id: 'spec-fm',
      name: 'С',
      type: 'Основная',
      productMaterialId: 'mat-gp-fm',
      techMapId: 'tm-fm',
      lines: [{ id: 'sl-fm', materialId: 'mat-fefo-mix', qtyPerUnit: 80 }],
    });
    store.create('production_orders', {
      id: 'ord-fm',
      materialId: 'mat-gp-fm',
      seriesId: 'ser-fm',
      specificationId: 'spec-fm',
      workCenterId: 'wc-fm',
      quantity: 1000,
      status: 'новый',
      startAt: `${isoDays(0)}T08:00:00.000Z`,
      endAt: `${isoDays(1)}T08:00:00.000Z`,
      lines: [],
    });
    const { picks } = planning.suggestPicksForOrder('ord-fm', 'FEFO');
    assert.equal(picks.length, 2);
    assert.equal(picks[0].lotId, 'lot-early');
    assert.equal(picks[0].quantity, 50);
    assert.equal(picks[1].lotId, 'lot-late');
    assert.equal(picks[1].quantity, 30);
  });

  test('без тогла смешения две партии по-прежнему запрещены', () => {
    store.create('materials', {
      id: 'mat-nomix',
      name: 'Стеарат',
      type: 'вспомогательный компонент',
      unit: 'кг',
      accountingModelId: accounting.MODEL_STANDARD_ID,
    });
    store.create('lots', {
      id: 'lot-n1',
      number: 'N1',
      materialId: 'mat-nomix',
      manufacturerId: 'mfr-1',
      productionDate: isoDays(-20),
      expiryDate: isoDays(100),
    });
    store.create('lots', {
      id: 'lot-n2',
      number: 'N2',
      materialId: 'mat-nomix',
      manufacturerId: 'mfr-1',
      productionDate: isoDays(-10),
      expiryDate: isoDays(90),
    });
    store.create('stock', {
      id: 'st-n1',
      materialId: 'mat-nomix',
      lotId: 'lot-n1',
      warehouseId: 'wh-components',
      quantity: 1,
    });
    store.create('stock', {
      id: 'st-n2',
      materialId: 'mat-nomix',
      lotId: 'lot-n2',
      warehouseId: 'wh-components',
      quantity: 1,
    });
    store.create('materials', { id: 'mat-gp-n', name: 'ГП', type: 'продукт', unit: 'уп' });
    store.create('series', { id: 'ser-n', number: 'SN', materialId: 'mat-gp-n' });
    store.create('work_centers', { id: 'wc-n', name: 'Л' });
    store.create('tech_maps', { id: 'tm-n', name: 'Т', workCenterId: 'wc-n' });
    store.create('specifications', {
      id: 'spec-n',
      name: 'С',
      type: 'Основная',
      productMaterialId: 'mat-gp-n',
      techMapId: 'tm-n',
      lines: [{ id: 'sl-n', materialId: 'mat-nomix', qtyPerUnit: 2 }],
    });
    store.create('production_orders', {
      id: 'ord-n',
      materialId: 'mat-gp-n',
      seriesId: 'ser-n',
      specificationId: 'spec-n',
      workCenterId: 'wc-n',
      quantity: 1000,
      status: 'новый',
      startAt: `${isoDays(0)}T08:00:00.000Z`,
      endAt: `${isoDays(1)}T08:00:00.000Z`,
      lines: [],
    });
    const { picks, warnings } = planning.suggestPicksForOrder('ord-n', 'FEFO');
    assert.equal(picks.length, 1);
    assert.equal(picks[0].ok, false);
    assert.ok(warnings.some((w) => /смешиван/i.test(w.message)));
  });
});
