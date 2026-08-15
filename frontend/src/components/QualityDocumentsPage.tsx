import { useEffect, useState } from 'react';
import { api } from '../api';
import { canViewObject } from '../auth/permissions';
import { useAuth } from '../auth/AuthContext';
import AccessDenied from './AccessDenied';
import IconButton from './IconButton';
import PageTitle from './PageTitle';
import RefreshButton from './RefreshButton';
import { QualityDocument } from '../types.documents';
import { Lot, Material } from '../types';

type Props = {
  lots: Lot[];
  materials: Material[];
};

const STATUS_LABEL: Record<string, string> = {
  draft: 'Создан',
  posted: 'Проведён',
  cancelled: 'Отменён',
};

export default function QualityDocumentsPage({ lots, materials }: Props) {
  const { user, openLogin } = useAuth();
  const [types, setTypes] = useState<{ id: string; code: string; label: string }[]>([]);
  const [rows, setRows] = useState<QualityDocument[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [draftType, setDraftType] = useState('');
  const [draftLotId, setDraftLotId] = useState('');
  const [draftReason, setDraftReason] = useState('');

  const currentUserId = user?.id || '';

  const load = async () => {
    const [meta, docs] = await Promise.all([api.qualityDocumentTypes(), api.listQualityDocuments()]);
    setTypes(meta.types);
    setRows(docs);
  };

  useEffect(() => {
    load().catch(console.error);
  }, []);

  const createDoc = async (type: string) => {
    if (!currentUserId) {
      openLogin();
      return;
    }
    if (type === 'quality_lot_block') {
      setDraftType(type);
      setDraftLotId('');
      setDraftReason('');
      setError('');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.createQualityDocument({
        type,
        createdByUserId: currentUserId,
        date: new Date().toISOString().slice(0, 10),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const createLotBlock = async () => {
    if (!currentUserId) {
      openLogin();
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.createQualityDocument({
        type: 'quality_lot_block',
        createdByUserId: currentUserId,
        date: new Date().toISOString().slice(0, 10),
        lotId: draftLotId,
        reason: draftReason.trim(),
      });
      setDraftType('');
      setDraftLotId('');
      setDraftReason('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const post = async (id: string) => {
    if (!currentUserId) {
      openLogin();
      return;
    }
    setBusy(true);
    try {
      await api.postQualityDocument(id, currentUserId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (id: string) => {
    if (!currentUserId) {
      openLogin();
      return;
    }
    if (!confirm('Отменить документ? Для QBL снимется блокировка партии, если нет другой активной.')) return;
    setBusy(true);
    try {
      await api.cancelQualityDocument(id, currentUserId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const lotNum = (id?: string | null) => (id ? lots.find((l) => l.id === id)?.number || id : '—');
  const matName = (id?: string | null) => (id ? materials.find((m) => m.id === id)?.name || id : '—');

  if (!canViewObject(user?.permissions, 'quality_documents', Boolean(user))) {
    return <AccessDenied title="Документы качества" />;
  }

  return (
    <div className="page">
      <PageTitle pageId="quality_documents" title="Управление качеством" />
      <p className="hint">
        Документы качества. Тип «Блокировка партии» (QBL) помечает партию в планировании красным (остаток не меняется;
        резерв пока разрешён).
      </p>

      <div className="toolbar" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label>
          Создать
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) createDoc(e.target.value);
            }}
          >
            <option value="">—</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <RefreshButton onClick={() => load()} disabled={busy} />
      </div>

      {draftType === 'quality_lot_block' && (
        <div className="card-form" style={{ marginTop: 12, display: 'grid', gap: 8, maxWidth: 480 }}>
          <strong>Новая блокировка партии (QBL)</strong>
          <label>
            Партия
            <select value={draftLotId} onChange={(e) => setDraftLotId(e.target.value)} disabled={busy}>
              <option value="">— выберите —</option>
              {lots.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.number}
                  {l.blocked ? ' (уже заблокирована)' : ''}
                </option>
              ))}
            </select>
          </label>
          <label>
            Причина
            <textarea
              value={draftReason}
              rows={3}
              disabled={busy}
              onChange={(e) => setDraftReason(e.target.value)}
              placeholder="Обязательное поле"
            />
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" disabled={busy || !draftLotId || !draftReason.trim()} onClick={createLotBlock}>
              Создать черновик
            </button>
            <button type="button" className="ghost" disabled={busy} onClick={() => setDraftType('')}>
              Отмена
            </button>
          </div>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Номер</th>
              <th>Дата</th>
              <th>Тип</th>
              <th>Статус</th>
              <th>Партия</th>
              <th>Материал</th>
              <th>Причина</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((doc) => (
              <tr key={doc.id} className={doc.type === 'quality_lot_block' && doc.status === 'posted' ? 'lot-block-row' : undefined}>
                <td>{doc.number}</td>
                <td>{doc.date}</td>
                <td>{types.find((t) => t.id === doc.type)?.label || doc.type}</td>
                <td>{STATUS_LABEL[doc.status] || doc.status}</td>
                <td>{lotNum(doc.lotId)}</td>
                <td>{matName(doc.materialId)}</td>
                <td>{doc.reason || '—'}</td>
                <td>
                  {doc.status === 'draft' && (
                    <IconButton
                      icon="complete"
                      label="Провести"
                      tone="success"
                      onClick={() => post(doc.id)}
                      disabled={busy}
                    />
                  )}
                  {doc.status !== 'cancelled' && (
                    <IconButton
                      icon="cancel"
                      label="Отменить"
                      tone="danger"
                      onClick={() => cancel(doc.id)}
                      disabled={busy}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
