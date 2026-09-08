import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  describeTemplate,
  generateNumber,
  parseNumber,
  plantLoadTemplate,
  normalizeTemplate,
} from '../src/services/numberTemplates.js';

describe('numberTemplates plant load+MM+YY rtl', () => {
  const tpl = plantLoadTemplate();

  test('разбор 90-й и 91-й загрузки', () => {
    assert.deepEqual(parseNumber('900726', tpl), { ok: true, load: 90 });
    assert.deepEqual(parseNumber('910726', tpl), { ok: true, load: 91 });
  });

  test('загрузка больше 99 — разбор с конца', () => {
    assert.deepEqual(parseNumber('1000726', tpl), { ok: true, load: 100 });
    assert.deepEqual(parseNumber('761026', tpl), { ok: true, load: 76 });
  });

  test('закупные номера не разбираются', () => {
    assert.equal(parseNumber('CAST4P2001', tpl).ok, false);
    assert.equal(parseNumber('34229', tpl).ok, false);
    assert.equal(parseNumber('10F8MRR', tpl).ok, false);
  });

  test('генерация зеркальна разбору', () => {
    assert.equal(generateNumber({ load: 90, date: '2026-07-01' }, tpl), '900726');
    assert.equal(generateNumber({ load: 100, date: '2026-07-15' }, tpl), '1000726');
    assert.equal(generateNumber({ load: 76, date: '2026-10-01' }, tpl), '761026');
  });

  test('описание шаблона', () => {
    assert.match(describeTemplate(tpl), /загрузка/);
    assert.match(describeTemplate(tpl), /справа/);
  });

  test('не больше одного rest', () => {
    assert.throws(() =>
      normalizeTemplate({
        parseDirection: 'rtl',
        tokens: [
          { type: 'digits', length: 'rest', role: 'load' },
          { type: 'digits', length: 'rest' },
        ],
      })
    );
  });
});
