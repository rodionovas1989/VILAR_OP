import { Modal } from './Modal';
import DocumentTracePanel from './DocumentTracePanel';
import { Lot, Material, Warehouse } from '../types';
import { DocumentTrace, OrderTrace } from '../types.documents';

type Props = {
  open: boolean;
  onClose: () => void;
  heading: string;
  trace: DocumentTrace | OrderTrace | null;
  loading?: boolean;
  materials: Material[];
  lots: Lot[];
  warehouses?: Warehouse[];
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
}: Props) {
  return (
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
      />
    </Modal>
  );
}
