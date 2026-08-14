import { ButtonHTMLAttributes, ReactNode } from 'react';

export type IconKind = 'edit' | 'view' | 'complete' | 'cancel' | 'delete' | 'refresh' | 'status';

const ICONS: Record<IconKind, ReactNode> = {
  edit: (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <path
        fill="currentColor"
        d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm17.71-10.04a1.003 1.003 0 0 0 0-1.42l-2.5-2.5a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.999-1.66z"
      />
    </svg>
  ),
  view: (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <path
        fill="currentColor"
        d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zm0 12.5a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"
      />
    </svg>
  ),
  complete: (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <path
        fill="currentColor"
        d="M12 2a10 10 0 1 0 .001 20.001A10 10 0 0 0 12 2zm-1.2 14.4-3.9-3.9 1.4-1.4 2.5 2.5 5.1-5.1 1.4 1.4-6.5 6.5z"
      />
    </svg>
  ),
  cancel: (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <path
        fill="currentColor"
        d="M12 2a10 10 0 1 0 .001 20.001A10 10 0 0 0 12 2zm3.3 13.3-1.4 1.4L12 13.4l-1.9 1.9-1.4-1.4 1.9-1.9-1.9-1.9 1.4-1.4 1.9 1.9 1.9-1.9 1.4 1.4-1.9 1.9 1.9 1.9z"
      />
    </svg>
  ),
  delete: (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <path
        fill="currentColor"
        d="M6 7h12v2H6V7zm2 3h8l-.7 10.1c-.05.7-.64 1.2-1.34 1.2H10c-.7 0-1.29-.5-1.34-1.2L8 10zm3-5h2l1 1h4v2H6V6h4l1-1z"
      />
    </svg>
  ),
  refresh: (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <path
        fill="currentColor"
        d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"
      />
    </svg>
  ),
  status: (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <path
        fill="currentColor"
        d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3zm-1 13-3.5-3.5 1.4-1.4L11 12.2l4.1-4.1 1.4 1.4L11 15z"
      />
    </svg>
  ),
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: IconKind;
  label: string;
  tone?: 'default' | 'success' | 'danger' | 'muted';
};

/** Компактная кнопка-пиктограмма с единым стилем */
export default function IconButton({ icon, label, tone = 'default', className = '', ...rest }: Props) {
  return (
    <button
      type="button"
      className={`icon-action icon-action-${tone} ${className}`.trim()}
      title={label}
      aria-label={label}
      {...rest}
    >
      {ICONS[icon]}
    </button>
  );
}
