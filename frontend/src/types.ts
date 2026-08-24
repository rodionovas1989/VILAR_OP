export type MaterialType =
  | 'продукт'
  | 'полуфабрикат'
  | 'основной компонент'
  | 'вспомогательный компонент';

export type OrderStatus = 'новый' | 'спланирован' | 'завершен' | 'отменен';

export interface Material {
  id: string;
  name: string;
  type: MaterialType;
  unit: string;
}

export interface SpecLine {
  id?: string;
  materialId: string;
  /** Норма расхода, кг на 1000 упаковок */
  qtyPerUnit: number;
  qtyMgPerTablet?: number;
  componentType?: string;
  /** none | assay_and_dry — расчёт по партии будет в следующей итерации */
  recalcMethod?: string;
  recalcXLabel?: number | null;
  recalcComment?: string;
  recalcFormula?: string;
}

/** Одобренная тройка: компонент × контрагент × производитель */
export interface ApprovedSupplier {
  materialId: string;
  counterpartyId: string;
  manufacturerId: string;
}

export interface Specification {
  id: string;
  name: string;
  productMaterialId: string;
  /** @deprecated не используется в UI */
  batchSizeUnits?: number;
  /** Основная | Альтернативная | Испытания */
  type?: string;
  /** Технологическая карта (обязательна) */
  techMapId?: string | null;
  lines: SpecLine[];
  approvedSuppliers?: ApprovedSupplier[];
}

export interface Counterparty {
  id: string;
  name: string;
}

export interface Manufacturer {
  id: string;
  name: string;
}

export interface Lot {
  id: string;
  number: string;
  materialId: string;
  counterpartyId: string | null;
  manufacturerId: string | null;
  productionDate: string;
  expiryDate: string;
  blocked?: boolean;
  blockReason?: string | null;
  blockDocumentId?: string | null;
}

export interface LotCharacteristic {
  id: string;
  code: string;
  name: string;
  kind?: 'system' | 'user';
  unit?: string;
  valueType?: string;
  min?: number;
  max?: number;
  required?: boolean;
  active?: boolean;
  comment?: string;
  materialIds?: string[];
  materialTypes?: string[];
}

export interface Series {
  id: string;
  number: string;
  materialId: string;
}

export interface Warehouse {
  id: string;
  name: string;
  /** компоненты | ГП */
  type: string;
}

export interface Stock {
  id: string;
  materialId: string;
  lotId: string;
  warehouseId?: string;
  quantity: number;
}

export interface Reservation {
  id: string;
  productionOrderId: string;
  materialId: string;
  quantity: number;
  lotId: string;
  seriesId: string;
}

export interface WorkCenter {
  id: string;
  name: string;
}

/** Технологическая карта: пока имя + рабочий центр (позже этапы / нормы времени) */
export interface TechMap {
  id: string;
  name: string;
  workCenterId: string;
}

/** Плановый объём серии: материал × рабочий центр → количество */
export interface PlannedSeriesVolume {
  id: string;
  materialId: string;
  workCenterId: string;
  quantity: number;
}

export interface SubstitutionLine {
  materialId: string;
  factor?: number;
  priority?: number;
}

/** Правило замены: шапка = базовый материал, ТЧ = аналоги */
export interface Substitution {
  id: string;
  name: string;
  baseMaterialId: string;
  bidirectional?: boolean;
  active?: boolean;
  specificationId?: string | null;
  lines: SubstitutionLine[];
}

export interface OrderLine {
  specLineId?: string | null;
  specMaterialId?: string | null;
  materialId: string;
  lotId: string;
  quantity: number;
  reservationId?: string;
  substitutionRuleId?: string | null;
}

export interface ProductionOrder {
  id: string;
  materialId: string;
  seriesId: string;
  workCenterId: string;
  startAt: string;
  endAt: string;
  /** Плановый выпуск */
  quantity: number;
  /** Фактический выпуск */
  actualQuantity?: number | null;
  status: OrderStatus;
  /** Плановый состав (резерв) */
  lines: OrderLine[];
  /** Фактический состав */
  actualLines?: OrderLine[];
  specificationId: string | null;
}

export interface MaterialMovement {
  id: string;
  materialId: string;
  lotId: string;
  seriesId: string;
  quantity: number;
  productionOrderId?: string;
  type: string;
  at: string;
  warehouseId?: string;
  documentId?: string;
  documentNumber?: string;
  documentType?: string;
  documentStatus?: string;
}

export interface MaterialPick {
  specLineId?: string;
  specMaterialId?: string;
  specMaterialName?: string;
  materialId: string;
  materialName?: string;
  substituted?: boolean;
  substitutionRuleId?: string | null;
  allowedMaterialIds?: string[];
  qtyPerUnit?: number;
  recalcMethod?: string;
  recalcXLabel?: number | null;
  nominalQuantity?: number;
  quantity: number;
  recalcApplied?: boolean;
  recalcMissing?: boolean;
  recalcUseAssay?: boolean;
  recalcUseLod?: boolean;
  recalcSnapshot?: { xLabel?: number; assay?: number | null; lossOnDrying?: number | null } | null;
  lotId: string | null;
  lotNumber?: string | null;
  counterpartyId?: string;
  counterpartyName?: string;
  manufacturerId?: string;
  manufacturerName?: string;
  expiryDate?: string;
  freeQty?: number;
  ok?: boolean;
  qualityPermission?: string;
  qualityPermissionLabel?: string;
  qualityName?: string | null;
  qualityMessage?: string | null;
  qualityAllowed?: boolean;
  characteristicValues?: Record<string, number>;
}

export interface ReleasedSeriesComponent {
  materialId: string;
  materialName: string;
  unit: string;
  lotId: string;
  lotNumber: string;
  quantity: number;
}

export interface ReleasedSeriesRow {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  seriesId: string;
  seriesNumber: string;
  lotId: string;
  lotNumber: string;
  productionDate: string;
  quantity: number;
  documentNumber: string;
  components: ReleasedSeriesComponent[];
}

export interface StockReportRow {
  id: string;
  warehouseId: string;
  warehouseName: string;
  warehouseType: string;
  materialId: string;
  materialName: string;
  materialType: string;
  unit: string;
  lotId: string;
  lotNumber: string;
  counterpartyId: string;
  counterpartyName: string;
  productionDate: string;
  expiryDate: string;
  quantity: number;
  reserved: number;
  free: number;
}

export interface QualityStockReportRow {
  id: string;
  materialId: string;
  materialName: string;
  materialType: string;
  unit: string;
  lotId: string;
  lotNumber: string;
  counterpartyName: string;
  productionDate: string;
  expiryDate: string;
  warehouseId: string;
  warehouseName: string;
  quantity: number;
  reserved: number;
  free: number;
  qualityMissing: boolean;
  qualityId?: string | null;
  qualityName?: string | null;
  permission: string;
  permissionLabel: string;
  documentNumber: string;
  updatedAt: string;
}

export interface QualityHistoryReportRow {
  id: string;
  at: string;
  action: string;
  actionLabel: string;
  documentId: string;
  documentNumber: string;
  documentType: string;
  documentStatus: string;
  materialId: string;
  materialName: string;
  materialType: string;
  unit: string;
  lotId: string;
  lotNumber: string;
  qualityId: string;
  qualityName: string;
  permission: string;
  permissionLabel: string;
  userId: string;
  userName: string;
}

export interface PlanFactReportRow {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  seriesId: string;
  seriesNumber: string;
  workCenterId: string;
  workCenterName: string;
  status: string;
  statusLabel: string;
  planStart: string;
  planEnd: string;
  planQuantity: number;
  factDate: string;
  factQuantity: number | null;
  quantityVariance: number | null;
}

export type FeedbackCategory = 'понравилось' | 'улучшить' | 'ошибка' | 'вопрос';
export type FeedbackStatus = 'новый' | 'в работе' | 'закрыт' | 'отклонён';

export interface FeedbackTicket {
  id: string;
  number: string;
  createdAt: string;
  updatedAt?: string;
  createdByUserId: string;
  createdByName: string;
  category: FeedbackCategory;
  title: string;
  body: string;
  pageId?: string;
  pageLabel?: string;
  status: FeedbackStatus;
  adminComment?: string;
  respondedAt?: string | null;
  respondedByUserId?: string | null;
  respondedByName?: string | null;
}
