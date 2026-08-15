import { useEffect, useState } from 'react';
import { api } from '../api';
import { canViewObject } from '../auth/permissions';
import { useAuth } from '../auth/AuthContext';
import AccessDenied from './AccessDenied';
import PageTitle from './PageTitle';
import RefreshButton from './RefreshButton';

export default function AdminChangelogPage() {
  const { user } = useAuth();
  const [markdown, setMarkdown] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const canRead = canViewObject(user?.permissions, 'admin_changelog');

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
      <p className="hint">Содержимое файла docs/CHANGELOG.md с сервера. При релизе дополняйте changelog и при необходимости тег vX.Y.Z.</p>
      {error && <p className="error">{error}</p>}
      <pre className="changelog-md">{markdown || (busy ? 'Загрузка…' : 'Пусто')}</pre>
    </div>
  );
}
