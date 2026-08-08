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
  qtyPerUnit: number;
  qtyMgPerTablet?: number;
  note?: string;
  componentType?: string;
}

export interface Specification {
  id: string;
  name: string;
  productMaterialId: string;
  batchSizeUnits: number;
  lines: SpecLine[];
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

export interface Stock {
  id: string;
  materialId: string;
  lotId: string;
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
  quantity: number;
  status: OrderStatus;
  lines: OrderLine[];
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
