import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { canViewObject } from '../auth/permissions';
import { useAuth } from '../auth/AuthContext';
import AccessDenied from './AccessDenied';
import PageTitle from './PageTitle';
import RefreshButton from './RefreshButton';
import {
  CHANGELOG_KIND_META,
  ChangelogKind,
  parseChangelog,
} from '../utils/changelog';

function KindIcon({ kind }: { kind: ChangelogKind }) {
  if (kind === 'new') {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
        <path
          fill="currentColor"
          d="M12 2 9.5 8.5 3 9.2l5 4.4L6.5 20 12 16.7 17.5 20 16 13.6l5-4.4-6.5-.7L12 2z"
        />
      </svg>
    );
  }
  if (kind === 'fix') {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
        <path
          fill="currentColor"
          d="M22.7 19.3 13.6 10.2a6 6 0 0 0-7.8-7.8l2.9 2.9-2.1 2.1-2.9-2.9a6 6 0 0 0 7.8 7.8l9.1 9.1a1 1 0 0 0 1.4 0l1.4-1.4a1 1 0 0 0 0-1.4z"
        />
      </svg>
    );
  }
  if (kind === 'security') {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
        <path
          fill="currentColor"
          d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3zm0 10.9 4-2.2V7.1L12 5.2 8 7.1v3.6l4 2.2z"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path
        fill="currentColor"
        d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
      />
    </svg>
  );
}

export default function AdminChangelogPage() {
  const { user } = useAuth();
  const [markdown, setMarkdown] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const canRead = canViewObject(user?.permissions, 'admin_changelog');
  const sections = useMemo(() => parseChangelog(markdown), [markdown]);

  const load = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await api.getChangelog();
      setMarkdown(res.markdown || '');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (canRead) load().catch(() => {});
  }, [canRead]);

  if (!canRead) {
    return <AccessDenied title="Что нового" />;
  }

  return (
    <div className="page">
      <div className="page-toolbar">
        <PageTitle pageId="admin_changelog" title="Что нового" />
        <RefreshButton onClick={() => load()} disabled={busy} />
      </div>
      <p className="hint">
        Обновления пилота по датам. Звезда — новое, карандаш — изменение, ключ — исправление, щит —
        безопасность.
      </p>
      {error && <p className="error">{error}</p>}

      {busy && !sections.length ? (
        <p className="muted">Загрузка…</p>
      ) : !sections.length ? (
        <p className="muted">Пока нет записей в журнале.</p>
      ) : (
        <div className="changelog-feed">
          {sections.map((section) => (
            <section key={section.dateLabel} className="changelog-day">
              <h2 className="changelog-day-title">{section.dateLabel}</h2>
              <ul className="changelog-list">
                {section.items.map((item, idx) => {
                  const meta = CHANGELOG_KIND_META[item.kind];
                  return (
                    <li key={`${section.dateLabel}-${idx}`} className={`changelog-item ${meta.className}`}>
                      <span className="changelog-kind" title={meta.label} aria-label={meta.label}>
                        <KindIcon kind={item.kind} />
                      </span>
                      <div className="changelog-item-body">
                        <span className="changelog-kind-label">{meta.label}</span>
                        {item.title ? <h3 className="changelog-item-title">{item.title}</h3> : null}
                        {item.body ? <p className="changelog-item-text">{item.body}</p> : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
