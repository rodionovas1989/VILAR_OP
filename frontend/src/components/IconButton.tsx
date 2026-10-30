import { ButtonHTMLAttributes, ReactNode } from 'react';

export type IconKind =
  | 'edit'
  | 'view'
  | 'complete'
  | 'cancel'
  | 'delete'
  | 'refresh'
  | 'status'
  | 'links'
  | 'help'
  | 'columns'
  | 'excel'
  | 'print'
  | 'create'
  | 'filter'
  | 'sort'
  | 'expandAll'
  | 'collapseAll';

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
  links: (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <path
        fill="currentColor"
        d="M7.5 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zm0-5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zM16.5 19.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zm0-5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zM16.5 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zm0-5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zM9.2 9.6l5.6-2.2.7 1.86-5.6 2.2-.7-1.86zm.7 2.9 5.6 2.2-.7 1.86-5.6-2.2.7-1.86z"
      />
    </svg>
  ),
  help: (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <path
        fill="currentColor"
        d="M12 2a10 10 0 1 0 .001 20.001A10 10 0 0 0 12 2zm0 15.2a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4zm1.4-4.55c-.62.36-1 .8-1 1.55h-1.6c0-1.22.58-1.95 1.42-2.44.7-.4 1.08-.72 1.08-1.36 0-.7-.56-1.2-1.4-1.2-.9 0-1.48.52-1.58 1.4H8.7c.12-1.78 1.5-2.95 3.32-2.95 1.9 0 3.18 1.12 3.18 2.72 0 .98-.5 1.7-1.8 2.48z"
      />
    </svg>
  ),
  columns: (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <path
        fill="currentColor"
        d="M3 5h4v14H3V5zm7 0h4v14h-4V5zm7 0h4v14h-4V5z"
      />
    </svg>
  ),
  excel: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M3 9h18M3 15h18M9 3v18M15 3v18" stroke="currentColor" strokeWidth="1.75" />
      <rect x="3.9" y="3.9" width="4.4" height="4.4" fill="currentColor" />
    </svg>
  ),
  create: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  filter: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden>
      <path
        d="M4.5 5h15l-5.5 7.1V19l-4 1.6v-8.5L4.5 5z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  ),
  expandAll: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden>
      <path d="M7 6.5 12 11.5 17 6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 12.5 12 17.5 17 12.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  collapseAll: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden>
      <path d="M7 11.5 12 6.5l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 17.5 12 12.5l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  sort: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden>
      <path d="M8 4v16M8 4 4.5 7.5M8 4l3.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 20V4M16 20l-3.5-3.5M16 20l3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  print: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden>
      <path
        d="M7 8V3.2c0-.7.5-1.2 1.2-1.2h7.6c.7 0 1.2.5 1.2 1.2V8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M9 4.3h6M9 6.3h3.2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path
        d="M4 8.5h16a2 2 0 0 1 2 2V15a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-4.5a2 2 0 0 1 2-2z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="18" cy="11.7" r="1" fill="currentColor" />
      <path
        d="M7 14.2h10V21a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1v-6.8z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M9.2 17.2h5.6M9.2 19.5h3.4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  ),
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: IconKind;
  label: string;
  tone?: 'default' | 'success' | 'danger' | 'muted';
  /** Число на бейдже (0 не показывается) */
  badge?: number;
  active?: boolean;
};

/** Компактная кнопка-пиктограмма с единым стилем */
export default function IconButton({
  icon,
  label,
  tone = 'default',
  badge = 0,
  active = false,
  className = '',
  ...rest
}: Props) {
  return (
    <button
      type="button"
      className={`icon-action icon-action-${tone}${active ? ' is-active' : ''} ${className}`.trim()}
      title={label}
      aria-label={label}
      {...rest}
    >
      {ICONS[icon]}
      {badge > 0 ? <span className="toolbar-icon-badge">{badge > 99 ? '99+' : badge}</span> : null}
    </button>
  );
}
