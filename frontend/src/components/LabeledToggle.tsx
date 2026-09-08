import { ReactNode } from 'react';
import ToggleSwitch from './ToggleSwitch';
import HintButton from './HintButton';

type Props = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  hintTitle?: string;
  hint?: ReactNode;
  disabled?: boolean;
};

/** Тогл слева, подпись справа, опционально «?» сразу после подписи. */
export default function LabeledToggle({
  checked,
  onCheckedChange,
  label,
  hintTitle,
  hint,
  disabled,
}: Props) {
  return (
    <div className="labeled-toggle">
      <ToggleSwitch checked={checked} onCheckedChange={onCheckedChange} label={label} disabled={disabled} />
      {hint ? (
        <HintButton title={hintTitle || label} label={`Подсказка: ${label}`}>
          {hint}
        </HintButton>
      ) : null}
    </div>
  );
}
