import { useState } from 'react';
import { Modal } from './Modal';
import DocumentTracePanel from './DocumentTracePanel';
import DocumentPeekModal from './DocumentPeekModal';
import { Lot, Material, Warehouse } from '../types';
import { DocumentTrace, OrderTrace, TraceDocumentRef } from '../types.documents';

type Props = {
  open: boolean;
  onClose: () => void;
  heading: string;
  trace: DocumentTrace | OrderTrace | null;
  loading?: boolean;
  materials: Material[];
  lots: Lot[];
  warehouses?: Warehouse[];
  /** После правки документа из peek — перезагрузить трассировку */
  onTraceRefresh?: () => void;
};

export default function DocumentTraceModal({
  open,
  onClose,
  heading,
  trace,
  loading,
  materials,
  lots,
  warehouses,
  onTraceRefresh,
}: Props) {
  const [peek, setPeek] = useState<{ ref: TraceDocumentRef; mode: 'view' | 'edit' } | null>(null);

  return (
    <>
      <Modal
        open={open}
        title={heading}
        onClose={onClose}
        wide
        nested
        className="modal-doc modal-trace"
        footer={
          <button type="button" className="ghost" onClick={onClose}>
            Закрыть
          </button>
        }
      >
        <DocumentTracePanel
          trace={trace}
          loading={loading}
          materials={materials}
          lots={lots}
          warehouses={warehouses}
          onOpenDocument={(doc, mode) => setPeek({ ref: doc, mode })}
        />
      </Modal>
      <DocumentPeekModal
        open={Boolean(peek)}
        mode={peek?.mode || 'view'}
        docRef={peek?.ref || null}
        onClose={() => setPeek(null)}
        onSaved={() => onTraceRefresh?.()}
        materials={materials}
        lots={lots}
        warehouses={warehouses}
      />
    </>
  );
}
