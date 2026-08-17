import fs from 'fs';
import os from 'os';
import path from 'path';
import { after, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vilar-recalc-'));
process.env.VILAR_SQLITE_PATH = path.join(tmp, 'test.sqlite');
process.env.VILAR_SKIP_JSON_IMPORT = '1';
process.env.VILAR_ADMIN_PASSWORD = 'TestAdmin1!';

const store = await import('../src/store.js');
const documents = await import('../src/services/documents.js');
const planning = await import('../src/services/planning.js');
const lotRecalc = await import('../src/services/lotRecalc.js');
const characteristics = await import('../src/services/characteristics.js');

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
    lines: [
      {
        id: 'sl-1',
        materialId: 'mat-rm',
        qtyPerUnit: 2,
        recalcMethod: 'assay_and_dry',
        recalcXLabel: 100,
      },
    ],
    approvedSuppliers: [],
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
  for (const row of store.readAll('lot_characteristics')) {
    if (row.code === 'assay' || row.code === 'loss_on_drying') {
      store.update('lot_characteristics', row.id, { ...row, materialIds: ['mat-rm'] });
    }
  }
}

function postValues(values) {
  const defs = store.readAll('lot_characteristics');
  const byCode = Object.fromEntries(defs.map((d) => [d.code, d]));
  const draft = characteristics.createCharacteristicDocument({
    createdByUserId: USER,
    lines: [
      {
        materialId: 'mat-rm',
        lotId: 'lot-rm',
        values: Object.entries(values).map(([code, value]) => ({
          characteristicId: byCode[code].id,
          value,
        })),
      },
    ],
  });
  return characteristics.postCharacteristicDocument(draft.id, USER);
}

beforeEach(() => {
  seedWorld();
});

after(() => {
  store.closeDb();
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('Формула пересчёта', () => {
  test('оба коэффициента: норматив × эталон × 100 / (содержание × (100 − потеря))', () => {
    const line = { qtyPerUnit: 2, recalcMethod: 'assay_and_dry', recalcXLabel: 100 };
    const lot = { characteristicValues: { assay: 95, loss_on_drying: 2 } };
    const r = lotRecalc.computeLineNeed(line, 1000, lot);
    assert.equal(r.nominal, 2);
    assert.equal(r.applied, true);
    assert.equal(r.missing, false);
    assert.equal(r.quantity, 2.148228);
  });

  test('нет факта при обоих применениях — эталон и потеря 0 %, missing', () => {
    const line = { qtyPerUnit: 2, recalcMethod: 'assay_and_dry', recalcXLabel: 100 };
    const r = lotRecalc.computeLineNeed(line, 1000, { characteristicValues: {} });
    assert.equal(r.quantity, 2);
    assert.equal(r.applied, false);
    assert.equal(r.missing, true);
  });

  test('есть только содержание при обоих применениях — потеря 0 %, missing', () => {
    const line = { qtyPerUnit: 2, recalcMethod: 'assay_and_dry', recalcXLabel: 100 };
    const r = lotRecalc.computeLineNeed(line, 1000, { characteristicValues: { assay: 80 } });
    assert.equal(r.quantity, 2.5);
    assert.equal(r.applied, false);
    assert.equal(r.missing, true);
  });

  test('в применении только содержание: норматив × 100 / содержание', () => {
    const assay = store.readAll('lot_characteristics').find((d) => d.code === 'assay');
    const lod = store.readAll('lot_characteristics').find((d) => d.code === 'loss_on_drying');
    store.update('lot_characteristics', assay.id, { ...assay, materialIds: ['mat-rm'], materialTypes: [] });
    store.update('lot_characteristics', lod.id, { ...lod, materialIds: [], materialTypes: [] });
    const line = {
      materialId: 'mat-rm',
      qtyPerUnit: 2,
      recalcMethod: 'assay_and_dry',
      recalcXLabel: 100,
    };
    const r = lotRecalc.computeLineNeed(line, 1000, {
      characteristicValues: { assay: 95, loss_on_drying: 2 },
    });
    assert.equal(r.useLod, false);
    assert.equal(r.useAssay, true);
    assert.equal(r.missing, false);
    assert.equal(r.quantity, 2.105263);
  });

  test('в применении только потеря: норматив × 100 / (100 − потеря)', () => {
    const assay = store.readAll('lot_characteristics').find((d) => d.code === 'assay');
    const lod = store.readAll('lot_characteristics').find((d) => d.code === 'loss_on_drying');
    store.update('lot_characteristics', assay.id, { ...assay, materialIds: [], materialTypes: [] });
    store.update('lot_characteristics', lod.id, { ...lod, materialIds: ['mat-rm'], materialTypes: [] });
    const line = {
      materialId: 'mat-rm',
      qtyPerUnit: 2,
      recalcMethod: 'assay_and_dry',
      recalcXLabel: 100,
    };
    const r = lotRecalc.computeLineNeed(line, 1000, { characteristicValues: { loss_on_drying: 2 } });
    assert.equal(r.useAssay, false);
    assert.equal(r.quantity, 2.040816);
  });
});

describe('Документ LCH пишет регистр', () => {
  test('проведение и отмена отката', () => {
    postValues({ assay: 95, loss_on_drying: 2 });
    assert.equal(characteristics.getLotCharacteristicMap('lot-rm').assay, 95);

    const defs = store.readAll('lot_characteristics');
    const dry = defs.find((d) => d.code === 'loss_on_drying');
    const draft2 = characteristics.createCharacteristicDocument({
      createdByUserId: USER,
      lines: [
        {
          materialId: 'mat-rm',
          lotId: 'lot-rm',
          values: [{ characteristicId: dry.id, value: 93 }],
        },
      ],
    });
    const posted2 = characteristics.postCharacteristicDocument(draft2.id, USER);
    assert.equal(characteristics.getLotCharacteristicMap('lot-rm').loss_on_drying, 93);
    assert.equal(characteristics.getLotCharacteristicMap('lot-rm').assay, 95);

    characteristics.cancelCharacteristicDocument(posted2.id, USER);
    assert.equal(characteristics.getLotCharacteristicMap('lot-rm').loss_on_drying, 2);
    assert.equal(characteristics.getLotCharacteristicMap('lot-rm').assay, 95);
  });
});

describe('Планирование читает регистр', () => {
  test('подбор берёт расход с учётом регистра', () => {
    postValues({ assay: 95, loss_on_drying: 2 });
    const draft = documents.createDocument('receipt', {
      createdByUserId: USER,
      warehouseToId: WH_C,
      lines: [{ materialId: 'mat-rm', lotId: 'lot-rm', quantity: 50 }],
    });
    documents.postDocument('receipt', draft.id, USER);

    const { picks, warnings } = planning.suggestPicksForOrder('ord-1', 'FEFO');
    assert.equal(picks[0].quantity, 2.148228);
    assert.equal(picks[0].recalcApplied, true);
    assert.equal(
      warnings.some((w) => String(w.message).includes('эталону')),
      false
    );
  });

  test('без LCH — номинал и предупреждение, процесс не стоп', () => {
    const draft = documents.createDocument('receipt', {
      createdByUserId: USER,
      warehouseToId: WH_C,
      lines: [{ materialId: 'mat-rm', lotId: 'lot-rm', quantity: 50 }],
    });
    documents.postDocument('receipt', draft.id, USER);

    const { picks, warnings } = planning.suggestPicksForOrder('ord-1', 'FEFO');
    assert.equal(picks[0].quantity, 2);
    assert.equal(picks[0].ok, true);
    assert.equal(picks[0].recalcMissing, true);
    assert.ok(warnings.some((w) => String(w.message).includes('эталону')));
  });
});

describe('Применение — источник полей LCH и пересчёта', () => {
  test('LCH только из применения: спека не добавляет вторую системную', () => {
    const assay = store.readAll('lot_characteristics').find((d) => d.code === 'assay');
    const dry = store.readAll('lot_characteristics').find((d) => d.code === 'loss_on_drying');
    store.update('lot_characteristics', assay.id, { ...assay, materialIds: ['mat-rm'], materialTypes: [] });
    store.update('lot_characteristics', dry.id, { ...dry, materialIds: [], materialTypes: [] });
    const list = characteristics.applicableCharacteristics('mat-rm');
    assert.deepEqual(
      list.map((d) => d.code),
      ['assay']
    );
  });

  test('документ LCH не принимает характеристику вне применения', () => {
    store.create('materials', {
      id: 'mat-other',
      name: 'Другой',
      type: 'вспомогательный компонент',
      unit: 'кг',
    });
    store.create('lots', {
      id: 'lot-other',
      number: 'OT-1',
      materialId: 'mat-other',
      counterpartyId: 'cp-1',
      productionDate: isoDays(-10),
      expiryDate: isoDays(200),
    });
    const dry = store.readAll('lot_characteristics').find((d) => d.code === 'loss_on_drying');
    assert.throws(
      () =>
        characteristics.createCharacteristicDocument({
          createdByUserId: USER,
          lines: [
            {
              materialId: 'mat-other',
              lotId: 'lot-other',
              values: [{ characteristicId: dry.id, value: 90 }],
            },
          ],
        }),
      /не применяется/
    );
  });

  test('системное название нельзя сменить', () => {
    const assay = store.readAll('lot_characteristics').find((d) => d.code === 'assay');
    const updated = characteristics.assertCharacteristicUpdate(
      { ...assay, name: 'Другое имя' },
      assay
    );
    assert.equal(updated.name, 'Количественное содержание');
    assert.equal(updated.code, 'assay');
    const unitLocked = characteristics.assertCharacteristicUpdate({ ...assay, unit: 'мг' }, assay);
    assert.equal(unitLocked.unit, '%');
  });

  test('пересчёт без применения считается как «Нет»', () => {
    store.create('materials', {
      id: 'mat-exc',
      name: 'Вспомогательный',
      type: 'вспомогательный компонент',
      unit: 'кг',
    });
    const line = {
      materialId: 'mat-exc',
      qtyPerUnit: 2,
      recalcMethod: 'assay_and_dry',
      recalcXLabel: 100,
    };
    const r = lotRecalc.computeLineNeed(line, 1000, {
      characteristicValues: { assay: 80, dry_substance: 90 },
    });
    assert.equal(r.method, 'none');
    assert.equal(r.quantity, 2);
  });
});
