import { NavVisualType, NAV_VISUAL_TYPE_LABEL, visualTypeForPage } from '../constants/navVisualTypes';

type Props = {
  type?: NavVisualType;
  pageId?: string;
  className?: string;
};

/** Типовая пиктограмма по семейству объекта (справочник / регистр / стол / …). */
export default function NavTypeIcon({ type, pageId, className = '' }: Props) {
  const visual = type || (pageId ? visualTypeForPage(pageId) : 'other');
  const title = NAV_VISUAL_TYPE_LABEL[visual];
  return (
    <span className={`nav-type-icon nav-type-icon--${visual} ${className}`.trim()} title={title} aria-hidden>
      <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.35">
        {visual === 'dictionary' && (
          <>
            <path d="M3.5 2.5h7.5a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z" />
            <path d="M5.5 5h5M5.5 7.5h5M5.5 10h3.5" strokeLinecap="round" />
          </>
        )}
        {visual === 'register_state' && (
          <>
            <rect x="2.5" y="3" width="11" height="10" rx="1" />
            <path d="M2.5 6h11M6 6v7M10 6v7" />
          </>
        )}
        {visual === 'register_history' && (
          <>
            <circle cx="8" cy="8" r="5.2" />
            <path d="M8 5.2v3.2l2.2 1.3" strokeLinecap="round" strokeLinejoin="round" />
          </>
        )}
        {visual === 'desktop' && (
          <>
            <rect x="2" y="3" width="12" height="8" rx="1" />
            <path d="M5.5 13h5M8 11v2" strokeLinecap="round" />
          </>
        )}
        {visual === 'document' && (
          <>
            <path d="M4.5 2.5h5.2L12 4.8V13a1 1 0 0 1-1 1H4.5a1 1 0 0 1-1-1v-9.5a1 1 0 0 1 1-1z" />
            <path d="M9.5 2.5V5H12" />
            <path d="M5.5 8h5M5.5 10.5h3.5" strokeLinecap="round" />
          </>
        )}
        {visual === 'report' && (
          <>
            <path d="M3 12.5V7.5M6.5 12.5V4.5M10 12.5V8.5M13.5 12.5V5.5" strokeLinecap="round" />
            <path d="M2.5 13h11.5" strokeLinecap="round" />
          </>
        )}
        {visual === 'admin' && (
          <>
            <circle cx="8" cy="8" r="2.2" />
            <path d="M8 2.8v1.4M8 11.8v1.4M2.8 8h1.4M11.8 8h1.4M4.2 4.2l1 1M10.8 10.8l1 1M11.8 4.2l-1 1M5.2 10.8l-1 1" strokeLinecap="round" />
          </>
        )}
        {visual === 'other' && (
          <>
            <circle cx="8" cy="8" r="5.2" />
            <circle cx="8" cy="8" r="1.2" fill="currentColor" stroke="none" />
          </>
        )}
      </svg>
    </span>
  );
}
