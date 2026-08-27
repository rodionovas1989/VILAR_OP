import { InputHTMLAttributes } from 'react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> & {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: string;
};

/** Современный переключатель вкл/выкл (вместо checkbox для настроек). */
export default function ToggleSwitch({
  checked,
  onCheckedChange,
  label,
  disabled,
  id,
  className = '',
  ...rest
}: Props) {
  const inputId = id || undefined;
  return (
    <label className={`toggle-switch ${disabled ? 'is-disabled' : ''} ${className}`.trim()}>
      <input
        {...rest}
        id={inputId}
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onCheckedChange(e.target.checked)}
      />
      <span className="toggle-switch-track" aria-hidden>
        <span className="toggle-switch-thumb" />
      </span>
      {label ? <span className="toggle-switch-label">{label}</span> : null}
    </label>
  );
}
