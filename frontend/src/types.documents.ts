export type DocumentStatus = 'draft' | 'posted' | 'cancelled' | 'fulfilled';

export type StockDocumentType =
  | 'receipt'
  | 'transfer'
  | 'inventory'
  | 'writeoff'
  | 'posting'
  | 'reservation'
  | 'production_issue'
  | 'production_receipt'
  | 'shipment';

export type QualityDocumentType = 'quality_management';

export interface QualityDocumentLine {
  id: string;
  materialId: string;
  lotId: string;
  qualityId: string;
}


export interface User {
  id: string;
  name: string;
  login?: string;
  role?: string;
  active?: boolean;
}

export interface StockDocumentLine {
  id: string;
  materialId: string;
  lotId: string;
  quantity: number;
  bookQuantity?: number;
  actualQuantity?: number;
}

export interface StockDocument {
  id: string;
  type: StockDocumentType;
  number: string;
  date: string;
  /** Время документа (ЧЧ:ММ), отдельно от даты для фильтрации */
  time?: string | null;
  status: DocumentStatus;
  warehouseId?: string | null;
  warehouseFromId?: string | null;
  warehouseToId?: string | null;
  productionOrderId?: string | null;
  seriesId?: string | null;
  basisDocumentId?: string | null;
  createdByUserId: string;
  createdAt: string;
  postedAt?: string | null;
  postedByUserId?: string | null;
  cancelledAt?: string | null;
  cancelledByUserId?: string | null;
  fulfilledAt?: string | null;
  fulfilledByUserId?: string | null;
  comment?: string;
  lines: StockDocumentLine[];
}

export interface DocumentTypeMeta {
  id: StockDocumentType;
  code: string;
  label: string;
  collection: string;
  warehouseMode: 'to' | 'from' | 'single' | 'both';
  canFulfill: boolean;
}

export interface ActiveReservation {
  id: string;
  documentId: string;
  productionOrderId?: string | null;
  materialId: string;
  lotId: string;
  quantity: number;
  seriesId?: string | null;
  warehouseId?: string;
}

export interface ReservationHistoryEntry {
  id: string;
  at: string;
  action: 'post' | 'cancel' | 'fulfill';
  documentId: string;
  documentNumber: string;
  documentType: string;
  documentStatus: string;
  materialId: string;
  lotId: string;
  quantity: number;
  productionOrderId?: string | null;
  userId?: string;
  basisDocumentId?: string | null;
  basisDocumentNumber?: string | null;
}

export interface TraceDocumentRef {
  id: string;
  type: string;
  number: string;
  status: DocumentStatus | string;
  date: string;
  productionOrderId?: string | null;
  basisDocumentId?: string | null;
}

export interface MaterialMovementRow {
  id: string;
  at: string;
  type: string;
  materialId: string;
  lotId: string;
  warehouseId?: string | null;
  quantity: number;
  documentId?: string;
  documentNumber?: string;
  documentStatus: string;
  productionOrderId?: string | null;
}

export interface StockRow {
  id: string;
  materialId: string;
  lotId: string;
  warehouseId?: string | null;
  quantity: number;
}

export interface QualityHistoryTraceRow {
  id: string;
  at: string;
  action: string;
  documentId?: string;
  documentNumber?: string;
  documentStatus?: string;
  lotId?: string | null;
  materialId?: string | null;
  qualityId?: string | null;
  qualityName?: string | null;
  permission?: string | null;
  permissionLabel?: string | null;
  userId?: string | null;
}

export interface QualityRegisterTraceRow {
  id: string;
  lotId: string;
  materialId?: string | null;
  qualityId?: string | null;
  qualityName?: string | null;
  permission?: string | null;
  permissionLabel?: string | null;
  documentId?: string | null;
  documentNumber?: string | null;
  updatedAt?: string | null;
}

export interface DocumentTrace {
  document: TraceDocumentRef;
  movements: MaterialMovementRow[];
  reservationHistory: ReservationHistoryEntry[];
  activeReservations: ActiveReservation[];
  relatedDocuments: TraceDocumentRef[];
  productionOrder: {
    id: string;
    status: string;
    quantity: number;
    seriesId?: string | null;
    materialId?: string | null;
  } | null;
  stock: StockRow[];
  /** Только для документа качества */
  qualityHistory?: QualityHistoryTraceRow[];
  qualityRegister?: QualityRegisterTraceRow[];
}

export interface OrderTrace {
  productionOrder: {
    id: string;
    status: string;
    quantity: number;
    seriesId?: string | null;
    materialId?: string | null;
  };
  documents: TraceDocumentRef[];
  movements: MaterialMovementRow[];
  reservationHistory: ReservationHistoryEntry[];
  activeReservations: ActiveReservation[];
}

export interface QualityDocument {
  id: string;
  type: QualityDocumentType;
  number: string;
  date: string;
  time?: string | null;
  status: DocumentStatus;
  lotId?: string | null;
  materialId?: string | null;
  reason?: string;
  createdByUserId: string;
  createdAt: string;
  comment?: string;
  lines?: QualityDocumentLine[];
}
