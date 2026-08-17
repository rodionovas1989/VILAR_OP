import { randomUUID } from 'crypto';
import * as store from '../store.js';
import {
  PARAM_DRY,
  LEGACY_PARAM_DRY,
  CHAR_KIND,
  SYSTEM_LOT_CHARACTERISTICS,
  CHARACTERISTIC_MANAGEMENT_TYPE,
  CHARACTERISTIC_DOCUMENT_STATUS,
  characteristicApplies,
} from '../constants/lotCharacteristics.js';

function cryptoRandom() {
  return randomUUID();
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function nowTime() {
  return new Date().toISOString().slice(11, 19);
}

function asNumber(value) {
  if (value === '' || value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function normalizeCharacteristic(item, { isUpdate = false } = {}) {
  const current = isUpdate ? item : item;
  const out = { ...current };
  out.code = String(out.code || '').trim();
  out.name = String(out.name || '').trim();
  out.unit = String(out.unit || '%').trim() || '%';
  out.valueType = out.valueType === 'number' || !out.valueType ? 'number' : String(out.valueType);
  out.kind = out.kind === CHAR_KIND.system ? CHAR_KIND.system : CHAR_KIND.user;
  out.active = out.active !== false;
  out.required = out.required === true;
  out.comment = out.comment ? String(out.comment) : '';
  out.materialIds = [...new Set((Array.isArray(out.materialIds) ? out.materialIds : []).filter(Boolean))];
  out.materialTypes = [...new Set((Array.isArray(out.materialTypes) ? out.materialTypes : []).filter(Boolean))];
  if (!out.code) throw new Error('Укажите код характеристики');
  if (!/^[a-z][a-z0-9_]*$/i.test(out.code)) throw new Error('Код: латиница, цифры и подчёркивание');
  if (!out.name) throw new Error('Укажите название характеристики');
  const dup = store.readAll('lot_characteristics').find((r) => r.code === out.code && r.id !== out.id);
  if (dup) throw new Error(`Код «${out.code}» уже используется`);
  for (const id of out.materialIds) {
    if (!store.getById('materials', id)) throw new Error('Материал в применении не найден');
  }
  return out;
}

export function assertCharacteristicCreate(item) {
  const out = normalizeCharacteristic(item);
  if (out.kind === CHAR_KIND.system) {
    const allowed = SYSTEM_LOT_CHARACTERISTICS.some((s) => s.code === out.code);
    if (!allowed) throw new Error('Системную характеристику нельзя создать вручную');
  }
  return out;
}

export function assertCharacteristicUpdate(merged, current) {
  if (current.kind === CHAR_KIND.system) {
    merged.kind = CHAR_KIND.system;
    merged.code = current.code;
    const seed = SYSTEM_LOT_CHARACTERISTICS.find((s) => s.code === current.code);
    merged.name = seed?.name || current.name;
    merged.unit = seed?.unit || current.unit;
    if (seed?.min != null) merged.min = seed.min;
    if (seed?.max != null) merged.max = seed.max;
  }
  return normalizeCharacteristic(merged, { isUpdate: true });
}

export function assertCharacteristicDeletable(row) {
  if (row?.kind === CHAR_KIND.system) {
    throw new Error('Системную характеристику нельзя удалить');
  }
}

export function listCharacteristics() {
  return store.readAll('lot_characteristics');
}

export function applicableCharacteristics(materialId) {
  const material = store.getById('materials', materialId);
  if (!material) return [];
  return listCharacteristics().filter((d) => d.active !== false && characteristicApplies(d, material));
}

export function getLotCharacteristicMap(lotId) {
  const out = {};
  if (!lotId) return out;
  for (const row of store.readAll('characteristic_register')) {
    if (row.lotId !== lotId) continue;
    if (row.value == null) continue;
    const code = row.code === LEGACY_PARAM_DRY ? PARAM_DRY : row.code;
    if (code) out[code] = Number(row.value);
  }
  return out;
}

export function registerRow(lotId, characteristicId) {
  return (
    store.readAll('characteristic_register').find((r) => r.lotId === lotId && r.characteristicId === characteristicId) ||
    null
  );
}

export function nextCharacteristicDocumentNumber(dateStr = todayIso()) {
  const code = CHARACTERISTIC_MANAGEMENT_TYPE.code;
  const key = `${code}:${dateStr}`;
  const sequences = store.readAll('document_sequences');
  const row = sequences.find((s) => s.key === key);
  const next = (row?.last ?? 0) + 1;
  if (row) {
    store.update('document_sequences', row.id, { last: next });
  } else {
    store.create('document_sequences', { id: cryptoRandom(), key, last: next });
  }
  return `${code}-${dateStr}-${String(next).padStart(5, '0')}`;
}

function normalizeValueEntries(rawValues, materialId) {
  const applicable = materialId ? applicableCharacteristics(materialId) : listCharacteristics();
  const allowed = new Map(applicable.map((d) => [d.id, d]));
  const out = [];
  const seen = new Set();
  for (const raw of Array.isArray(rawValues) ? rawValues : []) {
    const characteristicId = raw.characteristicId || null;
    if (!characteristicId || seen.has(characteristicId)) continue;
    const def = allowed.get(characteristicId) || store.getById('lot_characteristics', characteristicId);
    if (!def || def.active === false) continue;
    if (!allowed.has(def.id)) {
      const value = asNumber(raw.value);
      if (value == null) continue;
      throw new Error(`Характеристика «${def.name || def.code}» не применяется к выбранному материалу`);
    }
    seen.add(characteristicId);
    const value = asNumber(raw.value);
    out.push({
      characteristicId: def.id,
      code: def.code,
      name: def.name,
      unit: def.unit || '%',
      value,
    });
  }
  return out;
}

function normalizeLines(lines) {
  if (!Array.isArray(lines) || !lines.length) {
    throw new Error('Укажите хотя бы одну строку: материал и партия');
  }
  const out = [];
  const seenLots = new Set();
  for (const raw of lines) {
    const materialId = raw.materialId || null;
    const lotId = raw.lotId || null;
    if (!materialId || !lotId) throw new Error('В каждой строке укажите материал и партию');
    const lot = store.getById('lots', lotId);
    if (!lot) throw new Error('Партия не найдена');
    if (lot.materialId !== materialId) throw new Error('Партия не соответствует материалу');
    if (seenLots.has(lotId)) throw new Error('Одна партия не может встречаться в документе дважды');
    seenLots.add(lotId);
    out.push({
      id: raw.id || cryptoRandom(),
      materialId,
      lotId,
      values: normalizeValueEntries(raw.values, materialId),
    });
  }
  return out;
}

function filledValues(line) {
  return (line.values || []).filter((v) => v.value != null);
}

export function listCharacteristicDocuments(filter = {}) {
  let rows = store.readAll('characteristic_documents');
  if (filter.status) rows = rows.filter((d) => d.status === filter.status);
  return rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export function getCharacteristicDocument(id) {
  return store.getById('characteristic_documents', id);
}

export function createCharacteristicDocument(payload) {
  const userId = payload.createdByUserId;
  if (!userId) throw new Error('Укажите пользователя');
  if (!store.getById('users', userId)) throw new Error('Пользователь не найден');

  const date = payload.date || todayIso();
  const lines = normalizeLines(payload.lines);
  const doc = {
    id: cryptoRandom(),
    type: CHARACTERISTIC_MANAGEMENT_TYPE.id,
    number: nextCharacteristicDocumentNumber(date),
    date,
    time: payload.time || nowTime(),
    status: 'draft',
    createdByUserId: userId,
    createdAt: new Date().toISOString(),
    postedAt: null,
    cancelledAt: null,
    comment: payload.comment || '',
    lines,
  };
  return store.create('characteristic_documents', doc);
}

export function updateCharacteristicDocument(id, patch) {
  const current = getCharacteristicDocument(id);
  if (!current) throw new Error('Документ не найден');
  if (current.status !== 'draft') throw new Error('Редактирование только для статуса «Создан»');
  return store.update('characteristic_documents', id, {
    date: patch.date ?? current.date,
    time: patch.time ?? current.time,
    comment: patch.comment ?? current.comment,
    lines: patch.lines !== undefined ? normalizeLines(patch.lines) : current.lines,
  });
}

function appendHistory({ action, doc, line, entry, userId }) {
  store.create('characteristic_history', {
    id: cryptoRandom(),
    at: new Date().toISOString(),
    action,
    documentId: doc.id,
    documentNumber: doc.number,
    documentType: doc.type,
    documentStatus: doc.status,
    lotId: line.lotId,
    materialId: line.materialId,
    characteristicId: entry.characteristicId,
    code: entry.code,
    name: entry.name,
    unit: entry.unit,
    value: entry.value,
    userId,
  });
}

function applyEntryToRegister(doc, line, entry) {
  const existing = registerRow(line.lotId, entry.characteristicId);
  const patch = {
    lotId: line.lotId,
    materialId: line.materialId,
    characteristicId: entry.characteristicId,
    code: entry.code,
    name: entry.name,
    unit: entry.unit,
    value: entry.value,
    documentId: doc.id,
    documentNumber: doc.number,
    documentStatus: 'posted',
    updatedAt: new Date().toISOString(),
  };
  if (existing) {
    store.update('characteristic_register', existing.id, patch);
  } else {
    store.create('characteristic_register', { id: cryptoRandom(), ...patch });
  }
}

function restoreRegisterAfterCancel(lotId, characteristicId, cancelledDocId) {
  const current = registerRow(lotId, characteristicId);
  if (!current || current.documentId !== cancelledDocId) return;

  const prev = store
    .readAll('characteristic_history')
    .filter(
      (h) =>
        h.lotId === lotId &&
        h.characteristicId === characteristicId &&
        h.action === 'post' &&
        h.documentId !== cancelledDocId &&
        h.value != null
    )
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))[0];

  if (!prev) {
    store.removeMany('characteristic_register', [current.id]);
    return;
  }

  store.update('characteristic_register', current.id, {
    value: prev.value,
    code: prev.code,
    name: prev.name,
    unit: prev.unit,
    documentId: prev.documentId,
    documentNumber: prev.documentNumber,
    documentStatus: 'posted',
    materialId: prev.materialId || current.materialId,
    updatedAt: new Date().toISOString(),
  });
}

export function postCharacteristicDocument(id, userId) {
  return store.runWrite(() => {
    const doc = getCharacteristicDocument(id);
    if (!doc) throw new Error('Документ не найден');
    if (doc.status !== 'draft') throw new Error('Провести можно только документ «Создан»');
    const lines = normalizeLines(doc.lines);
    const hasValue = lines.some((l) => filledValues(l).length);
    if (!hasValue) throw new Error('Укажите хотя бы одно значение характеристики');

    const posted = store.update('characteristic_documents', id, {
      status: 'posted',
      postedAt: new Date().toISOString(),
      postedByUserId: userId,
      lines,
    });

    for (const line of lines) {
      for (const entry of filledValues(line)) {
        applyEntryToRegister(posted, line, entry);
        appendHistory({ action: 'post', doc: posted, line, entry, userId });
      }
    }

    return posted;
  });
}

export function cancelCharacteristicDocument(id, userId) {
  return store.runWrite(() => {
    const doc = getCharacteristicDocument(id);
    if (!doc) throw new Error('Документ не найден');
    if (doc.status === 'cancelled') throw new Error('Документ уже отменён');
    const wasPosted = doc.status === 'posted';

    const cancelled = store.update('characteristic_documents', id, {
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
      cancelledByUserId: userId,
    });

    for (const line of doc.lines || []) {
      for (const entry of filledValues(line)) {
        appendHistory({ action: 'cancel', doc: cancelled, line, entry, userId });
        if (wasPosted) restoreRegisterAfterCancel(line.lotId, entry.characteristicId, doc.id);
      }
    }

    return cancelled;
  });
}

export function getCharacteristicDocumentTrace(id) {
  const doc = getCharacteristicDocument(id);
  if (!doc) return null;
  const history = store
    .readAll('characteristic_history')
    .filter((h) => h.documentId === id || h.documentNumber === doc.number)
    .sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const lotIds = [...new Set((doc.lines || []).map((l) => l.lotId).filter(Boolean))];
  const register = store
    .readAll('characteristic_register')
    .filter((r) => lotIds.includes(r.lotId))
    .sort((a, b) => String(a.lotId).localeCompare(String(b.lotId)));
  return {
    document: {
      id: doc.id,
      type: doc.type,
      number: doc.number,
      status: doc.status,
      date: doc.date,
    },
    movements: [],
    reservationHistory: [],
    activeReservations: [],
    relatedDocuments: [],
    productionOrder: null,
    stock: [],
    qualityHistory: history,
    qualityRegister: register,
  };
}

export function missingRequiredMessages(lotId, materialId) {
  const messages = [];
  if (!lotId || !materialId) return messages;
  const lot = store.getById('lots', lotId);
  const values = getLotCharacteristicMap(lotId);
  const applicable = applicableCharacteristics(materialId);
  for (const def of applicable) {
    if (!def.required) continue;
    if (!(values[def.code] > 0) && values[def.code] !== 0) {
      messages.push(
        `${lot?.number || lotId}: не заполнена обязательная характеристика «${def.name}»`
      );
    }
  }
  return messages;
}

/**
 * Разово переносит lot.paramValues в проведённый LCH и снимает поле с партии.
 */
export function migrateParamValuesToDocuments() {
  const lots = store.readAll('lots').filter((l) => l.paramValues && typeof l.paramValues === 'object');
  if (!lots.length) return 0;
  const defs = listCharacteristics();
  const byCode = new Map(defs.map((d) => [d.code, d]));
  const admin = store.readAll('users').find((u) => u.login === 'Admin') || store.readAll('users')[0];
  if (!admin) return 0;
  let n = 0;
  for (const lot of lots) {
    const entries = [];
    for (const [code, raw] of Object.entries(lot.paramValues)) {
      const value = asNumber(raw);
      if (value == null) continue;
      const def = byCode.get(code);
      if (!def) continue;
      entries.push({
        characteristicId: def.id,
        code: def.code,
        name: def.name,
        unit: def.unit,
        value,
      });
    }
    store.update('lots', lot.id, { paramValues: undefined });
    if (!entries.length) continue;
    const date = todayIso();
    const doc = store.create('characteristic_documents', {
      id: cryptoRandom(),
      type: CHARACTERISTIC_MANAGEMENT_TYPE.id,
      number: nextCharacteristicDocumentNumber(date),
      date,
      time: nowTime(),
      status: 'posted',
      createdByUserId: admin.id,
      createdAt: new Date().toISOString(),
      postedAt: new Date().toISOString(),
      postedByUserId: admin.id,
      comment: 'Миграция значений с карточки партии',
      lines: [
        {
          id: cryptoRandom(),
          materialId: lot.materialId,
          lotId: lot.id,
          values: entries,
        },
      ],
    });
    const line = doc.lines[0];
    for (const entry of entries) {
      applyEntryToRegister(doc, line, entry);
      appendHistory({ action: 'post', doc, line, entry, userId: admin.id });
    }
    n += 1;
  }
  return n;
}

export { CHARACTERISTIC_MANAGEMENT_TYPE, CHARACTERISTIC_DOCUMENT_STATUS };
