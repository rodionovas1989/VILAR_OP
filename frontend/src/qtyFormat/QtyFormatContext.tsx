import { createContext, useContext, useMemo, type ReactNode } from 'react';
import {
  clampQtyDisplayDecimals,
  formatQty,
  formatQtyDelta,
  qtyDisplayDecimalsForMaterial,
} from '../utils/qty';

type MaterialRef = { id: string; accountingModelId?: string };
type ModelRef = { id: string; qtyDisplayDecimals?: number };

type QtyFormatApi = {
  decimalsFor: (materialId?: string | null) => number;
  formatMaterialQty: (n: number, materialId?: string | null) => string;
  formatMaterialQtyDelta: (n: number, materialId?: string | null) => string;
  /** Агрегаты без одного материала — default 3. */
  formatQtyDefault: (n: number) => string;
  formatQtyDeltaDefault: (n: number) => string;
};

const QtyFormatContext = createContext<QtyFormatApi | null>(null);

export function QtyFormatProvider({
  materials,
  accountingModels,
  children,
}: {
  materials: MaterialRef[];
  accountingModels: ModelRef[];
  children: ReactNode;
}) {
  const value = useMemo<QtyFormatApi>(() => {
    const decimalsFor = (materialId?: string | null) =>
      qtyDisplayDecimalsForMaterial(materialId, materials, accountingModels);
    return {
      decimalsFor,
      formatMaterialQty: (n, materialId) => formatQty(n, decimalsFor(materialId)),
      formatMaterialQtyDelta: (n, materialId) => formatQtyDelta(n, decimalsFor(materialId)),
      formatQtyDefault: (n) => formatQty(n, clampQtyDisplayDecimals(undefined)),
      formatQtyDeltaDefault: (n) => formatQtyDelta(n, clampQtyDisplayDecimals(undefined)),
    };
  }, [materials, accountingModels]);

  return <QtyFormatContext.Provider value={value}>{children}</QtyFormatContext.Provider>;
}

export function useQtyFormat(): QtyFormatApi {
  const ctx = useContext(QtyFormatContext);
  if (!ctx) {
    // Вне Provider (тесты/ранний boot): безопасный default 3.
    return {
      decimalsFor: () => clampQtyDisplayDecimals(undefined),
      formatMaterialQty: (n) => formatQty(n, clampQtyDisplayDecimals(undefined)),
      formatMaterialQtyDelta: (n) => formatQtyDelta(n, clampQtyDisplayDecimals(undefined)),
      formatQtyDefault: (n) => formatQty(n, clampQtyDisplayDecimals(undefined)),
      formatQtyDeltaDefault: (n) => formatQtyDelta(n, clampQtyDisplayDecimals(undefined)),
    };
  }
  return ctx;
}
