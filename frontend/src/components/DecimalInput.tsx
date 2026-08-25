import { InputHTMLAttributes, useEffect, useId, useRef, useState } from 'react';
import {
  formatDecimalDisplay,
  isAllowedDecimalDraft,
  parseDecimalDraft,
} from '../utils/decimalInput';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> & {
  value: number | null | undefined;
  onValueChange: (value: number) => void;
  /** min ≥ 0 по умолчанию для количеств; null — без нижней границы */
  min?: number | null;
  onReject?: (message: string) => void;
};

const REJECT_MSG = 'Допустимы цифры и разделитель (, или .)';

/**
 * Числовой ввод без type="number": некорректный символ не пишется в поле,
 * промежуточные значения вроде «12,» не обнуляют модель.
 */
export default function DecimalInput({
  value,
  onValueChange,
  min = 0,
  onReject,
  className,
  onBlur,
  onFocus,
  ...rest
}: Props) {
  const [text, setText] = useState(() => formatDecimalDisplay(value));
  const focusedRef = useRef(false);
  const rejectId = useId();
  const rejectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [rejectFlash, setRejectFlash] = useState('');

  useEffect(() => {
    if (!focusedRef.current) {
      setText(formatDecimalDisplay(value));
    }
  }, [value]);

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
    let next = parsed == null ? 0 : parsed;
    if (min != null && next < min) next = min;
    onValueChange(next);
    setText(formatDecimalDisplay(next));
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
          if (parsed == null) return;
          if (min != null && parsed < min) {
            flashReject(`Значение не меньше ${formatDecimalDisplay(min)}`);
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
