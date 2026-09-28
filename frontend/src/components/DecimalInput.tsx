import { InputHTMLAttributes, useEffect, useId, useRef, useState } from 'react';
import {
  formatDecimalDisplay,
  isAllowedDecimalDraft,
  parseDecimalDraft,
} from '../utils/decimalInput';
import { formatQty } from '../utils/qty';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange' | 'min'> & {
  value: number | null | undefined;
  onValueChange: (value: number | null) => void;
  /** min ≥ 0 по умолчанию для количеств; null — без нижней границы */
  min?: number | null;
  /** Разрешить пустое значение (null) */
  allowEmpty?: boolean;
  onReject?: (message: string) => void;
  /**
   * Знаков после запятой при показе (не в фокусе). На хранимое значение не влияет.
   * В фокусе — полная точность для правки.
   */
  displayDecimals?: number;
};

const REJECT_MSG = 'Допустимы цифры и разделитель (, или .)';

function toDisplay(value: number | null | undefined, displayDecimals?: number): string {
  if (value == null || !Number.isFinite(value)) return '';
  if (displayDecimals != null) {
    return formatQty(value, displayDecimals).replace('.', ',');
  }
  return formatDecimalDisplay(value);
}

/**
 * Числовой ввод без type="number": некорректный символ не пишется в поле,
 * промежуточные значения вроде «12,» не обнуляют модель.
 */
export default function DecimalInput({
  value,
  onValueChange,
  min = 0,
  allowEmpty = false,
  onReject,
  className,
  onBlur,
  onFocus,
  displayDecimals,
  ...rest
}: Props) {
  const [text, setText] = useState(() => toDisplay(value, displayDecimals));
  const focusedRef = useRef(false);
  const rejectId = useId();
  const rejectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [rejectFlash, setRejectFlash] = useState('');

  useEffect(() => {
    if (!focusedRef.current) {
      setText(toDisplay(value, displayDecimals));
    }
  }, [value, displayDecimals]);

  useEffect(
    () => () => {
      if (rejectTimer.current) clearTimeout(rejectTimer.current);
    },
    []
  );

  const flashReject = (message: string) => {
    onReject?.(message);
    setRejectFlash(message);
    if (rejectTimer.current) clearTimeout(rejectTimer.current);
    rejectTimer.current = setTimeout(() => setRejectFlash(''), 2200);
  };

  const commitText = (raw: string) => {
    const parsed = parseDecimalDraft(raw);
    if (parsed == null) {
      if (allowEmpty) {
        onValueChange(null);
        setText('');
        return;
      }
      let fallback = 0;
      if (min != null && fallback < min) fallback = min;
      onValueChange(fallback);
      setText(toDisplay(fallback, displayDecimals));
      return;
    }
    let next = parsed;
    if (min != null && next < min) next = min;
    onValueChange(next);
    setText(toDisplay(next, displayDecimals));
  };

  return (
    <span className={`decimal-input-wrap${className ? ` ${className}` : ''}`}>
      <input
        {...rest}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        aria-describedby={rejectFlash ? rejectId : undefined}
        value={text}
        onFocus={(e) => {
          focusedRef.current = true;
          // Полная точность для правки, даже если показ усечён.
          if (value != null && Number.isFinite(value)) {
            setText(formatDecimalDisplay(value));
          }
          onFocus?.(e);
        }}
        onChange={(e) => {
          const raw = e.target.value;
          if (!isAllowedDecimalDraft(raw)) {
            flashReject(REJECT_MSG);
            return;
          }
          setText(raw);
          const parsed = parseDecimalDraft(raw);
          if (parsed == null) {
            if (allowEmpty && raw.trim() === '') onValueChange(null);
            return;
          }
          if (min != null && parsed < min) {
            flashReject(`Значение не меньше ${toDisplay(min, displayDecimals)}`);
            return;
          }
          onValueChange(parsed);
        }}
        onBlur={(e) => {
          focusedRef.current = false;
          commitText(e.target.value);
          onBlur?.(e);
        }}
      />
      {rejectFlash ? (
        <span id={rejectId} className="decimal-input-reject" role="status">
          {rejectFlash}
        </span>
      ) : null}
    </span>
  );
}
