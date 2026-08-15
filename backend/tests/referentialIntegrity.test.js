import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vilar-ref-'));
process.env.VILAR_SQLITE_PATH = path.join(tmpDir, 't.sqlite');
process.env.VILAR_SKIP_JSON_IMPORT = '1';
process.env.VILAR_ADMIN_PASSWORD = 'TestAdmin1!';

const { ensureCollections, create, closeDb } = await import('../src/store.js');
const { assertCanDelete, findUsages } = await import('../src/services/referentialIntegrity.js');

ensureCollections();

test('нельзя удалить материал, на который ссылается партия', () => {
  create('materials', {
    id: 'mat-x',
    name: 'Компонент X',
    type: 'основной компонент',
    unit: 'кг',
  });
  create('lots', {
    id: 'lot-x',
    number: 'LOT-X',
    materialId: 'mat-x',
    counterpartyId: null,
    productionDate: '2026-01-01',
    expiryDate: '2028-01-01',
  });

  const usages = findUsages('materials', 'mat-x');
  assert.ok(usages.some((u) => u.collection === 'lots'));
  assert.throws(() => assertCanDelete('materials', ['mat-x']), /Нельзя удалить/);
});

test('свободный материал удаляется без ошибки проверки', () => {
  create('materials', {
    id: 'mat-free',
    name: 'Свободный',
    type: 'основной компонент',
    unit: 'кг',
  });
  assert.equal(findUsages('materials', 'mat-free').length, 0);
  assert.doesNotThrow(() => assertCanDelete('materials', ['mat-free']));
});

test.after(() => {
  closeDb();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});
