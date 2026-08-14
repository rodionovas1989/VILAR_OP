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
  materialId: string;
  /** Норма расхода, кг на 1000 упаковок */
  qtyPerUnit: number;
  qtyMgPerTablet?: number;
  componentType?: string;
}

/** Одобренный поставщик компонента в спецификации */
export interface ApprovedSupplier {
  materialId: string;
  counterpartyId: string;
}

export interface Specification {
  id: string;
  name: string;
  productMaterialId: string;
  /** @deprecated не используется в UI */
  batchSizeUnits?: number;
  /** Основная | Альтернативная | Испытания */
  type?: string;
  lines: SpecLine[];
  approvedSuppliers?: ApprovedSupplier[];
}

export interface Counterparty {
  id: string;
  name: string;
}

export interface Lot {
  id: string;
  number: string;
  materialId: string;
  counterpartyId: string | null;
  productionDate: string;
  expiryDate: string;
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

/** Плановый объём серии: материал × рабочий центр → количество */
export interface PlannedSeriesVolume {
  id: string;
  materialId: string;
  workCenterId: string;
  quantity: number;
}

export interface OrderLine {
  materialId: string;
  lotId: string;
  quantity: number;
  reservationId?: string;
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
  materialId: string;
  materialName?: string;
  quantity: number;
  lotId: string | null;
  lotNumber?: string | null;
  counterpartyId?: string;
  counterpartyName?: string;
  expiryDate?: string;
  freeQty?: number;
  ok?: boolean;
}
