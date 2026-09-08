import { useState } from 'react';
import LabeledToggle from './LabeledToggle';

export type NumberToken =
  | { type: 'literal'; value: string }
  | { type: 'digits'; length: number | 'rest'; role?: 'load' | 'none' }
  | { type: 'date'; part: 'YYYY' | 'YY' | 'MM' | 'DD'; source?: string };

export type NumberTemplate = {
  parseDirection: 'rtl' | 'ltr';
  tokens: NumberToken[];
};

export const PLANT_LOAD_TEMPLATE: NumberTemplate = {
  parseDirection: 'rtl',
  tokens: [
    { type: 'digits', length: 'rest', role: 'load' },
    { type: 'date', part: 'MM', source: 'productionDate' },
    { type: 'date', part: 'YY', source: 'productionDate' },
  ],
};

export function emptyNumberTemplate(): NumberTemplate {
  return { parseDirection: 'rtl', tokens: [] };
}

export function describeNumberTemplate(template: NumberTemplate | null | undefined) {
  const tokens = Array.isArray(template?.tokens) ? template.tokens : [];
  if (!tokens.length) return 'без шаблона';
  const parts = tokens.map((t) => {
    if (t.type === 'literal') return `«${t.value}»`;
    if (t.type === 'date') return t.part;
    if (t.length === 'rest') return t.role === 'load' ? 'загрузка' : 'цифры…';
    return `${t.length} цифр`;
  });
  const dir = template?.parseDirection === 'ltr' ? 'слева направо' : 'справа налево';
  return `${parts.join(' + ')} (${dir})`;
}

export function tokenLabel(token: NumberToken) {
  if (token.type === 'literal') return `«${token.value}»`;
  if (token.type === 'date') return token.part;
  if (token.length === 'rest') return token.role === 'load' ? 'Загрузка' : 'Цифры…';
  return `${token.length} цифр`;
}

const PREVIEW_DATE = { y: 2026, m: 7, d: 1 };
const PREVIEW_LOAD = 90;

function pad(n: number, width: number) {
  return String(n).padStart(width, '0');
}

function tokenPreview(token: NumberToken, load: number) {
  if (token.type === 'literal') return token.value;
  if (token.type === 'date') {
    if (token.part === 'YYYY') return pad(PREVIEW_DATE.y, 4);
    if (token.part === 'YY') return pad(PREVIEW_DATE.y % 100, 2);
    if (token.part === 'MM') return pad(PREVIEW_DATE.m, 2);
    return pad(PREVIEW_DATE.d, 2);
  }
  if (token.length === 'rest') return String(load);
  if (token.role === 'load') return pad(load, token.length);
  return '0'.repeat(token.length);
}

/** Пример номера по шаблону (загрузка 90, дата 01.07.2026). */
export function previewNumberTemplate(template: NumberTemplate | null | undefined, load = PREVIEW_LOAD) {
  const tokens = Array.isArray(template?.tokens) ? template.tokens : [];
  if (!tokens.length) return '';
  return tokens.map((token) => tokenPreview(token, load)).join('');
}

type Props = {
  value: NumberTemplate;
  onChange: (next: NumberTemplate) => void;
};

export default function NumberTemplateBuilder({ value, onChange }: Props) {
  const tpl: NumberTemplate = {
    parseDirection: value?.parseDirection === 'ltr' ? 'ltr' : 'rtl',
    tokens: Array.isArray(value?.tokens) ? value.tokens : [],
  };

  const setTokens = (tokens: NumberToken[]) => onChange({ ...tpl, tokens });

  const move = (index: number, dir: -1 | 1) => {
    const next = [...tpl.tokens];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j], next[index]];
    setTokens(next);
  };

  const [literalDraft, setLiteralDraft] = useState('-');
  const [digitsDraft, setDigitsDraft] = useState('2');

  const addLiteral = () => {
    const text = literalDraft.trim();
    if (!text) return;
    setTokens([...tpl.tokens, { type: 'literal', value: text }]);
  };

  const addDigits = () => {
    const n = Number(digitsDraft);
    if (!Number.isInteger(n) || n < 1 || n > 32) return;
    setTokens([...tpl.tokens, { type: 'digits', length: n, role: 'none' }]);
  };

  const preview = previewNumberTemplate(tpl);

  return (
    <div
      className="number-template-builder"
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.preventDefault();
      }}
    >
      <div className="number-template-editor-result">
        <span className="muted">Пример номера</span>
        <code className="number-template-result">{preview || '—'}</code>
      </div>
      <div className="number-template-toolbar">
        <LabeledToggle
          checked={tpl.parseDirection === 'rtl'}
          onCheckedChange={(on) => onChange({ ...tpl, parseDirection: on ? 'rtl' : 'ltr' })}
          label={tpl.parseDirection === 'rtl' ? 'Разбор справа налево' : 'Разбор слева направо'}
          hint={
            <p>
              Справа налево сначала снимает фиксированный хвост (месяц, год), слева остаётся номер загрузки
              любой длины. Слева направо — обычный разбор с начала строки.
            </p>
          }
        />
      </div>
      <div className="number-template-actions">
        <button type="button" className="ghost" onClick={() => onChange(PLANT_LOAD_TEMPLATE)}>
          Пресет: загрузка + MM + YY
        </button>
        <button
          type="button"
          className="ghost"
          onClick={() => setTokens([...tpl.tokens, { type: 'digits', length: 'rest', role: 'load' }])}
        >
          + Загрузка
        </button>
        <button
          type="button"
          className="ghost"
          onClick={() => setTokens([...tpl.tokens, { type: 'date', part: 'MM', source: 'productionDate' }])}
        >
          + MM
        </button>
        <button
          type="button"
          className="ghost"
          onClick={() => setTokens([...tpl.tokens, { type: 'date', part: 'YY', source: 'productionDate' }])}
        >
          + YY
        </button>
        <button
          type="button"
          className="ghost"
          onClick={() => setTokens([...tpl.tokens, { type: 'date', part: 'YYYY', source: 'productionDate' }])}
        >
          + YYYY
        </button>
        <button
          type="button"
          className="ghost"
          onClick={() => setTokens([...tpl.tokens, { type: 'date', part: 'DD', source: 'productionDate' }])}
        >
          + DD
        </button>
        <span className="number-template-add">
          <input
            className="ctrl"
            value={digitsDraft}
            onChange={(e) => setDigitsDraft(e.target.value)}
            aria-label="Число цифр"
            inputMode="numeric"
          />
          <button type="button" className="ghost" onClick={addDigits}>
            + N цифр
          </button>
        </span>
        <span className="number-template-add">
          <input
            className="ctrl"
            value={literalDraft}
            onChange={(e) => setLiteralDraft(e.target.value)}
            aria-label="Литерал"
          />
          <button type="button" className="ghost" onClick={addLiteral}>
            + Литерал
          </button>
        </span>
        {tpl.tokens.length > 0 ? (
          <button type="button" className="ghost" onClick={() => setTokens([])}>
            Очистить
          </button>
        ) : null}
      </div>
      {tpl.tokens.length === 0 ? (
        <p className="muted">Нет блоков — номер свободный (типично для закупа).</p>
      ) : (
        <ol className="number-template-tokens">
          {tpl.tokens.map((token, index) => (
            <li key={`${token.type}-${index}`}>
              <span className="number-template-chip">{tokenLabel(token)}</span>
              <button type="button" className="ghost" disabled={index === 0} onClick={() => move(index, -1)}>
                ↑
              </button>
              <button
                type="button"
                className="ghost"
                disabled={index === tpl.tokens.length - 1}
                onClick={() => move(index, 1)}
              >
                ↓
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => setTokens(tpl.tokens.filter((_, i) => i !== index))}
              >
                ×
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
