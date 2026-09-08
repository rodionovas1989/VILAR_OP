/** Калькулятор маски номера партии/серии: токены + направление разбора. */

export const PARSE_DIRECTIONS = ['rtl', 'ltr'];
export const DATE_PARTS = ['YYYY', 'YY', 'MM', 'DD'];
export const TOKEN_TYPES = ['literal', 'digits', 'date'];

export function emptyTemplate() {
  return { parseDirection: 'rtl', tokens: [] };
}

export function plantLoadTemplate() {
  return {
    parseDirection: 'rtl',
    tokens: [
      { type: 'digits', length: 'rest', role: 'load' },
      { type: 'date', part: 'MM', source: 'productionDate' },
      { type: 'date', part: 'YY', source: 'productionDate' },
    ],
  };
}

export function hasTokens(template) {
  return Array.isArray(template?.tokens) && template.tokens.length > 0;
}

function asInt(value, label) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 32) {
    throw new Error(`${label}: укажите длину от 1 до 32`);
  }
  return n;
}

function normalizeToken(raw, index) {
  const type = String(raw?.type || '').trim();
  if (!TOKEN_TYPES.includes(type)) {
    throw new Error(`Блок ${index + 1}: неизвестный тип`);
  }
  if (type === 'literal') {
    const value = String(raw.value || '');
    if (!value) throw new Error(`Блок ${index + 1}: укажите литерал или разделитель`);
    return { type, value };
  }
  if (type === 'date') {
    const part = String(raw.part || '').trim();
    if (!DATE_PARTS.includes(part)) {
      throw new Error(`Блок ${index + 1}: часть даты YYYY, YY, MM или DD`);
    }
    return { type, part, source: 'productionDate' };
  }
  const length = raw.length === 'rest' ? 'rest' : asInt(raw.length, `Блок ${index + 1}`);
  const role = raw.role === 'load' ? 'load' : 'none';
  return { type: 'digits', length, role };
}

export function normalizeTemplate(raw) {
  if (raw == null || raw === '') return emptyTemplate();
  const src = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const parseDirection = PARSE_DIRECTIONS.includes(src.parseDirection) ? src.parseDirection : 'rtl';
  const tokens = Array.isArray(src.tokens) ? src.tokens.map(normalizeToken) : [];
  const restCount = tokens.filter((t) => t.type === 'digits' && t.length === 'rest').length;
  if (restCount > 1) throw new Error('В шаблоне может быть только один блок «остаток»');
  return { parseDirection, tokens };
}

export function validateTemplate(raw) {
  normalizeTemplate(raw);
  return true;
}

function ymd(iso) {
  const s = String(iso || '').slice(0, 10);
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  return { y, m, d };
}

function dateWidth(part) {
  if (part === 'YYYY') return 4;
  return 2;
}

function emitDatePart(iso, part) {
  const parts = ymd(iso);
  if (!parts) throw new Error('Для генерации номера укажите дату');
  if (part === 'YYYY') return String(parts.y).padStart(4, '0');
  if (part === 'YY') return String(parts.y % 100).padStart(2, '0');
  if (part === 'MM') return String(parts.m).padStart(2, '0');
  return String(parts.d).padStart(2, '0');
}

function validDateTaken(part, taken) {
  if (!/^\d+$/.test(taken)) return false;
  const n = Number(taken);
  if (part === 'MM') return n >= 1 && n <= 12 && taken.length === 2;
  if (part === 'DD') return n >= 1 && n <= 31 && taken.length === 2;
  if (part === 'YY') return taken.length === 2;
  if (part === 'YYYY') return taken.length === 4 && n >= 1900 && n <= 2100;
  return false;
}

function consume(str, fromEnd, n) {
  if (n > str.length) return null;
  if (fromEnd) return { taken: str.slice(str.length - n), rest: str.slice(0, str.length - n) };
  return { taken: str.slice(0, n), rest: str.slice(n) };
}

/**
 * @param {string} number
 * @param {{ parseDirection?: string, tokens?: object[] }} template
 * @returns {{ ok: boolean, load?: number | null, error?: string }}
 */
export function parseNumber(number, template) {
  const tpl = normalizeTemplate(template);
  const raw = String(number || '').trim();
  if (!hasTokens(tpl)) return { ok: false, error: 'Шаблон пуст' };
  if (!raw) return { ok: false, error: 'Пустой номер' };

  const fromEnd = tpl.parseDirection === 'rtl';
  const order = fromEnd ? [...tpl.tokens].reverse() : tpl.tokens;
  let cursor = raw;
  let load = null;

  for (const token of order) {
    if (token.type === 'literal') {
      const lit = token.value;
      if (fromEnd) {
        if (!cursor.endsWith(lit)) return { ok: false, error: `Ожидалось «${lit}»` };
        cursor = cursor.slice(0, cursor.length - lit.length);
      } else {
        if (!cursor.startsWith(lit)) return { ok: false, error: `Ожидалось «${lit}»` };
        cursor = cursor.slice(lit.length);
      }
      continue;
    }
    if (token.type === 'date') {
      const width = dateWidth(token.part);
      const step = consume(cursor, fromEnd, width);
      if (!step || !validDateTaken(token.part, step.taken)) {
        return { ok: false, error: `Некорректная часть даты ${token.part}` };
      }
      cursor = step.rest;
      continue;
    }
    if (token.length === 'rest') {
      if (!cursor.length || !/^\d+$/.test(cursor)) {
        return { ok: false, error: 'Ожидались цифры загрузки' };
      }
      const n = Number(cursor);
      if (!Number.isInteger(n) || n < 1) return { ok: false, error: 'Номер загрузки должен быть ≥ 1' };
      if (token.role === 'load') load = n;
      cursor = '';
      continue;
    }
    const step = consume(cursor, fromEnd, token.length);
    if (!step || !/^\d+$/.test(step.taken)) {
      return { ok: false, error: `Ожидалось ${token.length} цифр` };
    }
    if (token.role === 'load') load = Number(step.taken);
    cursor = step.rest;
  }

  if (cursor.length) return { ok: false, error: 'Лишние символы в номере' };
  return { ok: true, load };
}

/**
 * @param {{ date?: string, load?: number }} ctx
 * @param {{ parseDirection?: string, tokens?: object[] }} template
 */
export function generateNumber(ctx, template) {
  const tpl = normalizeTemplate(template);
  if (!hasTokens(tpl)) throw new Error('Шаблон пуст');
  let out = '';
  for (const token of tpl.tokens) {
    if (token.type === 'literal') {
      out += token.value;
      continue;
    }
    if (token.type === 'date') {
      out += emitDatePart(ctx?.date, token.part);
      continue;
    }
    if (token.length === 'rest') {
      const n = Number(ctx?.load);
      if (!Number.isInteger(n) || n < 1) throw new Error('Укажите номер загрузки');
      out += String(n);
      continue;
    }
    const n = Number(ctx?.load);
    if (token.role === 'load') {
      if (!Number.isInteger(n) || n < 1) throw new Error('Укажите номер загрузки');
      out += String(n).padStart(token.length, '0');
    } else {
      out += '0'.repeat(token.length);
    }
  }
  return out;
}

export function describeTemplate(template) {
  const tpl = normalizeTemplate(template);
  if (!hasTokens(tpl)) return 'без шаблона';
  const parts = tpl.tokens.map((t) => {
    if (t.type === 'literal') return `«${t.value}»`;
    if (t.type === 'date') return t.part;
    if (t.length === 'rest') return t.role === 'load' ? 'загрузка' : 'цифры…';
    return `${t.length} цифр`;
  });
  const dir = tpl.parseDirection === 'rtl' ? 'справа налево' : 'слева направо';
  return `${parts.join(' + ')} (${dir})`;
}
