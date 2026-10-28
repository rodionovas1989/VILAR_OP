import { useEffect, useState } from 'react';
import { api } from '../api';
import { Lot, Material, Warehouse } from '../types';
import { TraceDocumentRef } from '../types.documents';
import { dateFromIso, displayTimeFromIso } from '../utils/docDateTime';
import { useQtyFormat } from '../qtyFormat/QtyFormatContext';
import { Modal } from './Modal';

const DOC_STATUS: Record<string, string> = {
  draft: 'Создан',
  posted: 'Проведён',
  cancelled: 'Отменён',
  fulfilled: 'Выполнен',
};

const DOC_TYPE: Record<string, string> = {
  receipt: 'Приёмка',
  transfer: 'Перемещение',
  inventory: 'Инвентаризация',
  writeoff: 'Списание',
  posting: 'Оприходование',
  reservation: 'Резервирование',
  production_issue: 'Списание в производство',
  production_receipt: 'Выпуск из производства',
  shipment: 'Отгрузка',
  quality_management: 'Управление качеством',
  lot_characteristic_management: 'Управление характеристиками',
};

type PeekMode = 'view' | 'edit';

type Props = {
  open: boolean;
  mode: PeekMode;
  docRef: TraceDocumentRef | null;
  onClose: () => void;
  onSaved?: () => void;
  materials: Material[];
  lots: Lot[];
  warehouses?: Warehouse[];
};

type PeekDoc = {
  id: string;
  type: string;
  number: string;
  status: string;
  date?: string;
  comment?: string;
  warehouseFromId?: string | null;
  warehouseToId?: string | null;
  lines?: Array<{
    id?: string;
    materialId?: string;
    lotId?: string;
    quantity?: number;
    factQuantity?: number;
    qualityId?: string;
    characteristicId?: string;
    value?: number | string;
  }>;
};

async function loadDocument(ref: TraceDocumentRef): Promise<PeekDoc> {
  if (ref.type === 'quality_management') {
    const d = await api.getQualityDocument(ref.id);
    return { ...d, type: 'quality_management' } as PeekDoc;
  }
  if (ref.type === 'lot_characteristic_management') {
    const d = await api.getCharacteristicDocument(ref.id);
    return { ...d, type: 'lot_characteristic_management' } as PeekDoc;
  }
  const d = await api.getDocument(ref.type, ref.id);
  return { ...d, type: ref.type } as PeekDoc;
}

export default function DocumentPeekModal({
  open,
  mode,
  docRef,
  onClose,
  onSaved,
  materials,
  lots,
  warehouses = [],
}: Props) {
  const { formatMaterialQty } = useQtyFormat();
  const [doc, setDoc] = useState<PeekDoc | null>(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [formMode, setFormMode] = useState<PeekMode>(mode);

  useEffect(() => {
    if (!open || !docRef) {
      setDoc(null);
      setError('');
      return;
    }
    setFormMode(mode);
    setBusy(true);
    setError('');
    loadDocument(docRef)
      .then((d) => {
        setDoc(d);
        setComment(String(d.comment || ''));
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(false));
  }, [open, docRef, mode]);

  const matName = (id?: string | null) =>
    (id && materials.find((m) => m.id === id)?.name) || id || '—';
  const lotNum = (id?: string | null) =>
    (id && lots.find((l) => l.id === id)?.number) || id || '—';
  const whName = (id?: string | null) =>
    (id && warehouses.find((w) => w.id === id)?.name) || id || '—';

  const canEditDraft =
    formMode === 'edit' &&
    doc?.status === 'draft' &&
    doc.type !== 'quality_management' &&
    doc.type !== 'lot_characteristic_management';

  const saveComment = async () => {
    if (!doc || !canEditDraft) return;
    setBusy(true);
    setError('');
    try {
      const updated = (await api.updateDocument(doc.type, doc.id, {
        ...doc,
        comment,
      })) as PeekDoc;
      setDoc({ ...updated, type: doc.type });
      setFormMode('view');
      onSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const title = doc
    ? `${DOC_TYPE[doc.type] || doc.type} ${doc.number}`
    : docRef
      ? `${DOC_TYPE[docRef.type] || docRef.type} ${docRef.number}`
      : 'Документ';

  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      wide
      nested
      className="modal-doc modal-peek"
      footer={
        <>
          {canEditDraft ? (
            <button type="button" disabled={busy} onClick={() => void saveComment()}>
              Сохранить
            </button>
          ) : null}
          {doc?.status === 'draft' && formMode === 'view' ? (
            <button type="button" className="ghost" disabled={busy} onClick={() => setFormMode('edit')}>
              Редактировать
            </button>
          ) : null}
          <button type="button" className="ghost" onClick={onClose}>
            Закрыть
          </button>
        </>
      }
    >
      {busy && !doc && <p className="hint">Загрузка документа…</p>}
      {error && <p className="error">{error}</p>}
      {doc && (
        <div className="doc-form-scroll">
          <div className="form-grid">
            <label>
              Статус
              <input value={DOC_STATUS[doc.status] || doc.status} readOnly disabled />
            </label>
            <label>
              Дата
              <input
                value={
                  doc.date
                    ? `${dateFromIso(doc.date)} ${displayTimeFromIso(doc.date)}`.trim()
                    : '—'
                }
                readOnly
                disabled
              />
            </label>
            {doc.warehouseFromId ? (
              <label>
                Склад (откуда)
                <input value={whName(doc.warehouseFromId)} readOnly disabled />
              </label>
            ) : null}
            {doc.warehouseToId ? (
              <label>
                Склад (куда)
                <input value={whName(doc.warehouseToId)} readOnly disabled />
              </label>
            ) : null}
            <label className="full-width">
              Комментарий
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                disabled={!canEditDraft || busy}
                rows={2}
              />
            </label>
          </div>

          {formMode === 'edit' && !canEditDraft ? (
            <p className="hint">
              Редактирование строк и проведение — в разделе документа. Здесь доступен просмотр; для
              черновиков складских документов можно править комментарий.
            </p>
          ) : null}

          <div className="table-wrap peek-lines">
            <table className="data-table doc-lines-table">
              <thead>
                <tr>
                  <th>Материал</th>
                  <th>Партия</th>
                  <th>Количество</th>
                  {doc.type === 'inventory' ? <th>Факт</th> : null}
                </tr>
              </thead>
              <tbody>
                {(doc.lines || []).map((line, idx) => (
                  <tr key={line.id || `${idx}`}>
                    <td>{matName(line.materialId)}</td>
                    <td>{lotNum(line.lotId)}</td>
                    <td>{formatMaterialQty(Number(line.quantity) || 0, line.materialId)}</td>
                    {doc.type === 'inventory' ? (
                      <td>
                        {formatMaterialQty(Number(line.factQuantity) || 0, line.materialId)}
                      </td>
                    ) : null}
                  </tr>
                ))}
                {!(doc.lines || []).length && (
                  <tr>
                    <td colSpan={doc.type === 'inventory' ? 4 : 3} className="muted">
                      Нет строк
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}
