import * as store from '../store.js';
import * as documents from './documents.js';
import { resolveLotQuality } from './quality.js';
import { labelLotQualityPermission } from '../constants/lotQuality.js';

const DONE_STATUS = 'завершен';
const ACTION_LABEL = { post: 'Проведение', cancel: 'Отмена' };

function indexById(rows) {
  const map = {};
  for (const row of rows) map[row.id] = row;
  return map;
}

/** Отчёт: выпущенные серии продукции (завершённые заказы). */
export function releasedSeriesReport() {
  const materials = indexById(store.readAll('materials'));
  const seriesMap = indexById(store.readAll('series'));
  const lotsList = store.readAll('lots');
  const lots = indexById(lotsList);
  const register = store
    .readAll('production_register')
    .filter((r) => r.documentStatus !== 'cancelled');

  const orders = store.readAll('production_orders').filter((o) => o.status === DONE_STATUS);
  const rows = [];

  for (const order of orders) {
    const moves = register.filter((r) => r.productionOrderId === order.id);
    const receipts = moves.filter((r) => r.type === 'receipt' || Number(r.quantity) > 0);
    const issues = moves.filter((r) => r.type === 'issue' || Number(r.quantity) < 0);

    if (receipts.length || issues.length) {
      const gpMove = receipts[0] || null;
      const gpLot = gpMove?.lotId ? lots[gpMove.lotId] : null;
      const quantity = receipts.reduce((s, r) => s + Math.abs(Number(r.quantity) || 0), 0);
      rows.push({
        id: order.id,
        orderId: order.id,
        productId: gpMove?.materialId || order.materialId,
        productName:
          materials[gpMove?.materialId || order.materialId]?.name || order.materialId,
        seriesId: gpMove?.seriesId || order.seriesId || '',
        seriesNumber:
          gpMove?.seriesNumber ||
          seriesMap[order.seriesId]?.number ||
          order.seriesId ||
          '—',
        lotId: gpLot?.id || gpMove?.lotId || '',
        lotNumber: gpLot?.number || gpMove?.lotId || '—',
        productionDate: gpLot?.productionDate || String(gpMove?.at || '').slice(0, 10) || '—',
        quantity:
          quantity ||
          (order.actualQuantity != null ? Number(order.actualQuantity) : Number(order.quantity)) ||
          0,
        documentNumber: gpMove?.documentNumber || '',
        components: issues.map((l) => {
          const mat = materials[l.materialId];
          const lot = lots[l.lotId];
          return {
            materialId: l.materialId,
            materialName: mat?.name || l.materialId,
            unit: mat?.unit || '',
            lotId: l.lotId || '',
            lotNumber: lot?.number || l.lotId || '—',
            quantity: Math.abs(Number(l.quantity) || 0),
          };
        }),
      });
      continue;
    }

    // fallback: старые завершённые заказы без движений в регистре
    const series = seriesMap[order.seriesId];
    const prrDocs = documents
      .listDocuments('production_receipt', { productionOrderId: order.id })
      .filter((d) => d.status === 'posted');
    const prr = prrDocs[0] || null;
    const gpLine = prr?.lines?.[0] || null;
    const gpLot =
      (gpLine?.lotId && lots[gpLine.lotId]) ||
      lotsList.find((l) => l.number === `ГП-${series?.number || ''}`) ||
      null;

    const quantity =
      order.actualQuantity != null && Number(order.actualQuantity) > 0
        ? Number(order.actualQuantity)
        : gpLine
          ? Number(gpLine.quantity)
          : Number(order.quantity) || 0;

    const productionDate =
      gpLot?.productionDate || prr?.date || String(order.endAt || '').slice(0, 10) || '—';

    const factLines =
      Array.isArray(order.actualLines) && order.actualLines.length > 0
        ? order.actualLines
        : order.lines || [];

    rows.push({
      id: order.id,
      orderId: order.id,
      productId: order.materialId,
      productName: materials[order.materialId]?.name || order.materialId,
      seriesId: order.seriesId || '',
      seriesNumber: series?.number || order.seriesId || '—',
      lotId: gpLot?.id || gpLine?.lotId || '',
      lotNumber: gpLot?.number || gpLine?.lotId || '—',
      productionDate,
      quantity,
      documentNumber: prr?.number || '',
      components: factLines.map((l) => {
        const mat = materials[l.materialId];
        const lot = lots[l.lotId];
        return {
          materialId: l.materialId,
          materialName: mat?.name || l.materialId,
          unit: mat?.unit || '',
          lotId: l.lotId || '',
          lotNumber: lot?.number || l.lotId || '—',
          quantity: Number(l.quantity) || 0,
        };
      }),
    });
  }

  rows.sort(
    (a, b) =>
      String(b.productionDate).localeCompare(String(a.productionDate)) ||
      String(a.seriesNumber).localeCompare(String(b.seriesNumber), 'ru', { numeric: true })
  );
  return rows;
}

export function filterReleasedSeries(rows, ids) {
  if (!Array.isArray(ids) || !ids.length) return rows;
  const set = new Set(ids.map(String));
  return rows.filter((r) => set.has(String(r.id)));
}

const STATUS_LABEL = {
  новый: 'Новый',
  спланирован: 'Спланирован',
  завершен: 'Завершен',
  отменен: 'Отменен',
};

/**
 * План/Факт производства по заказам.
 * Фильтр периода — по горизонту плана (пересечение startAt..endAt с [from, to]).
 * includeCancelled — показывать отменённые (по умолчанию нет).
 */
export function planFactReport({ from, to, includeCancelled = false } = {}) {
  const materials = indexById(store.readAll('materials'));
  const seriesMap = indexById(store.readAll('series'));
  const wcs = indexById(store.readAll('work_centers'));
  const lotsList = store.readAll('lots');
  const lots = indexById(lotsList);

  const fromDay = from ? String(from).slice(0, 10) : null;
  const toDay = to ? String(to).slice(0, 10) : null;

  const rows = [];
  for (const order of store.readAll('production_orders')) {
    if (!includeCancelled && order.status === 'отменен') continue;

    const planStart = String(order.startAt || '').slice(0, 10);
    const planEnd = String(order.endAt || '').slice(0, 10);
    if (fromDay && planEnd && planEnd < fromDay) continue;
    if (toDay && planStart && planStart > toDay) continue;

    const series = seriesMap[order.seriesId];
    const prrDocs = documents
      .listDocuments('production_receipt', { productionOrderId: order.id })
      .filter((d) => d.status === 'posted');
    const prr = prrDocs[0] || null;
    const gpLine = prr?.lines?.[0] || null;
    const gpLot =
      (gpLine?.lotId && lots[gpLine.lotId]) ||
      lotsList.find((l) => l.number === `ГП-${series?.number || ''}`) ||
      null;

    const planQty = Number(order.quantity) || 0;
    let factQty = null;
    if (order.actualQuantity != null && Number(order.actualQuantity) > 0) {
      factQty = Number(order.actualQuantity);
    } else if (order.status === DONE_STATUS) {
      factQty = gpLine ? Number(gpLine.quantity) : planQty;
    }

    const factDate =
      order.status === DONE_STATUS
        ? gpLot?.productionDate || prr?.date || planEnd || '—'
        : null;

    const qtyVariance = factQty != null ? roundQty(factQty - planQty) : null;

    rows.push({
      id: order.id,
      orderId: order.id,
      productId: order.materialId,
      productName: materials[order.materialId]?.name || order.materialId,
      seriesId: order.seriesId || '',
      seriesNumber: series?.number || order.seriesId || '—',
      workCenterId: order.workCenterId || '',
      workCenterName: wcs[order.workCenterId]?.name || '—',
      status: order.status,
      statusLabel: STATUS_LABEL[order.status] || order.status,
      planStart,
      planEnd,
      planQuantity: planQty,
      factDate: factDate || '—',
      factQuantity: factQty,
      quantityVariance: qtyVariance,
    });
  }

  rows.sort(
    (a, b) =>
      String(a.planStart).localeCompare(String(b.planStart)) ||
      String(a.seriesNumber).localeCompare(String(b.seriesNumber), 'ru', { numeric: true })
  );
  return rows;
}

export function filterPlanFactReport(rows, ids) {
  if (!Array.isArray(ids) || !ids.length) return rows;
  const set = new Set(ids.map(String));
  return rows.filter((r) => set.has(String(r.id)));
}

function roundQty(n) {
  return Number(Number(n || 0).toFixed(6));
}

/** Отчёт запасов: плоские строки партия×склад (иерархия собирается на клиенте и в Excel). */
export function stockReport() {
  const stock = store.readAll('stock');
  const materials = indexById(store.readAll('materials'));
  const lots = indexById(store.readAll('lots'));
  const warehouses = indexById(store.readAll('warehouses'));
  const counterparties = indexById(store.readAll('counterparties'));
  const reservations = store.readAll('active_reservations');

  const reservedByKey = {};
  for (const r of reservations) {
    const key = `${r.warehouseId || ''}|${r.lotId}`;
    reservedByKey[key] = roundQty((reservedByKey[key] || 0) + Number(r.quantity || 0));
  }

  const rows = [];
  for (const s of stock) {
    const qty = roundQty(s.quantity);
    const lot = lots[s.lotId];
    const materialId = s.materialId || lot?.materialId || '';
    const material = materials[materialId];
    const warehouseId = s.warehouseId || '';
    const warehouse = warehouses[warehouseId];
    const cp = lot?.counterpartyId ? counterparties[lot.counterpartyId] : null;
    const reserved = reservedByKey[`${warehouseId}|${s.lotId}`] || 0;
    const free = roundQty(qty - reserved);
    if (qty === 0 && reserved === 0) continue;

    rows.push({
      id: s.id,
      warehouseId: warehouseId || 'none',
      warehouseName: warehouse?.name || 'Без склада',
      warehouseType: warehouse?.type || '—',
      materialId: materialId || 'none',
      materialName: material?.name || materialId || '—',
      materialType: material?.type || '—',
      unit: material?.unit || '',
      lotId: s.lotId || '',
      lotNumber: lot?.number || s.lotId || '—',
      counterpartyId: lot?.counterpartyId || '',
      counterpartyName: cp?.name || '—',
      productionDate: lot?.productionDate || '—',
      expiryDate: lot?.expiryDate || '—',
      quantity: qty,
      reserved,
      free,
    });
  }

  rows.sort(
    (a, b) =>
      a.warehouseName.localeCompare(b.warehouseName, 'ru') ||
      a.materialName.localeCompare(b.materialName, 'ru') ||
      String(a.expiryDate).localeCompare(String(b.expiryDate)) ||
      a.lotNumber.localeCompare(b.lotNumber, 'ru', { numeric: true })
  );
  return rows;
}

export function filterStockReport(rows, ids) {
  if (!Array.isArray(ids) || !ids.length) return rows;
  const set = new Set(ids.map(String));
  return rows.filter((r) => set.has(String(r.id)));
}

export function groupStockRows(rows) {
  const warehouses = [];
  const whMap = new Map();
  for (const row of rows) {
    let wh = whMap.get(row.warehouseId);
    if (!wh) {
      wh = {
        id: row.warehouseId,
        name: row.warehouseName,
        type: row.warehouseType,
        quantity: 0,
        reserved: 0,
        free: 0,
        materials: [],
      };
      whMap.set(row.warehouseId, wh);
      warehouses.push(wh);
    }
    let mat = wh.materials.find((m) => m.id === row.materialId);
    if (!mat) {
      mat = {
        id: row.materialId,
        name: row.materialName,
        type: row.materialType,
        unit: row.unit,
        quantity: 0,
        reserved: 0,
        free: 0,
        lots: [],
      };
      wh.materials.push(mat);
    }
    mat.lots.push(row);
    mat.quantity = roundQty(mat.quantity + row.quantity);
    mat.reserved = roundQty(mat.reserved + row.reserved);
    mat.free = roundQty(mat.free + row.free);
    wh.quantity = roundQty(wh.quantity + row.quantity);
    wh.reserved = roundQty(wh.reserved + row.reserved);
    wh.free = roundQty(wh.free + row.free);
  }
  return warehouses;
}

/**
 * Отчёт качества запасов: плоские строки склад×партия (qty > 0).
 * Качество на уровне партии; qualityMissing — нет строки в регистре.
 */
export function qualityStockReport() {
  const stock = store.readAll('stock');
  const materials = indexById(store.readAll('materials'));
  const lots = indexById(store.readAll('lots'));
  const warehouses = indexById(store.readAll('warehouses'));
  const counterparties = indexById(store.readAll('counterparties'));
  const reservations = store.readAll('active_reservations');
  const registerByLot = indexById(
    store.readAll('quality_register').map((r) => ({ ...r, id: r.lotId }))
  );

  const reservedByKey = {};
  for (const r of reservations) {
    const key = `${r.warehouseId || ''}|${r.lotId}`;
    reservedByKey[key] = roundQty((reservedByKey[key] || 0) + Number(r.quantity || 0));
  }

  const qualityCache = new Map();
  const qualityForLot = (lotId) => {
    if (!lotId) return resolveLotQuality('');
    if (qualityCache.has(lotId)) return qualityCache.get(lotId);
    const q = resolveLotQuality(lotId);
    const reg = registerByLot[lotId];
    const out = {
      ...q,
      qualityMissing: Boolean(q.defaulted),
      documentNumber: reg?.documentNumber || '',
      updatedAt: reg?.updatedAt || '',
    };
    qualityCache.set(lotId, out);
    return out;
  };

  const rows = [];
  for (const s of stock) {
    const qty = roundQty(s.quantity);
    if (!(qty > 0)) continue;
    const lot = lots[s.lotId];
    const materialId = s.materialId || lot?.materialId || '';
    const material = materials[materialId];
    const warehouseId = s.warehouseId || '';
    const warehouse = warehouses[warehouseId];
    const cp = lot?.counterpartyId ? counterparties[lot.counterpartyId] : null;
    const reserved = reservedByKey[`${warehouseId}|${s.lotId}`] || 0;
    const free = roundQty(qty - reserved);
    const q = qualityForLot(s.lotId);

    rows.push({
      id: s.id,
      materialId: materialId || 'none',
      materialName: material?.name || materialId || '—',
      materialType: material?.type || '—',
      unit: material?.unit || '',
      lotId: s.lotId || '',
      lotNumber: lot?.number || s.lotId || '—',
      counterpartyName: cp?.name || '—',
      productionDate: lot?.productionDate || '—',
      expiryDate: lot?.expiryDate || '—',
      warehouseId: warehouseId || 'none',
      warehouseName: warehouse?.name || 'Без склада',
      quantity: qty,
      reserved,
      free,
      qualityMissing: q.qualityMissing,
      qualityId: q.qualityId,
      qualityName: q.qualityMissing ? null : q.qualityName,
      permission: q.permission,
      permissionLabel: q.permissionLabel || labelLotQualityPermission(q.permission),
      documentNumber: q.documentNumber || '',
      updatedAt: q.updatedAt || '',
    });
  }

  rows.sort(
    (a, b) =>
      a.materialName.localeCompare(b.materialName, 'ru') ||
      a.lotNumber.localeCompare(b.lotNumber, 'ru', { numeric: true }) ||
      a.warehouseName.localeCompare(b.warehouseName, 'ru')
  );
  return rows;
}

export function filterQualityStockReport(rows, ids) {
  if (!Array.isArray(ids) || !ids.length) return rows;
  const set = new Set(ids.map(String));
  return rows.filter((r) => set.has(String(r.id)));
}

/** Группировка: материал → партия → склады (для Excel/UI). */
export function groupQualityStockRows(rows) {
  const materials = [];
  const matMap = new Map();
  for (const row of rows) {
    let mat = matMap.get(row.materialId);
    if (!mat) {
      mat = {
        id: row.materialId,
        name: row.materialName,
        type: row.materialType,
        unit: row.unit,
        quantity: 0,
        reserved: 0,
        free: 0,
        lots: [],
      };
      matMap.set(row.materialId, mat);
      materials.push(mat);
    }
    let lot = mat.lots.find((l) => l.id === row.lotId);
    if (!lot) {
      lot = {
        id: row.lotId,
        lotNumber: row.lotNumber,
        counterpartyName: row.counterpartyName,
        productionDate: row.productionDate,
        expiryDate: row.expiryDate,
        qualityMissing: row.qualityMissing,
        qualityName: row.qualityName,
        permission: row.permission,
        permissionLabel: row.permissionLabel,
        documentNumber: row.documentNumber,
        updatedAt: row.updatedAt,
        quantity: 0,
        reserved: 0,
        free: 0,
        warehouses: [],
      };
      mat.lots.push(lot);
    }
    lot.warehouses.push(row);
    lot.quantity = roundQty(lot.quantity + row.quantity);
    lot.reserved = roundQty(lot.reserved + row.reserved);
    lot.free = roundQty(lot.free + row.free);
    mat.quantity = roundQty(mat.quantity + row.quantity);
    mat.reserved = roundQty(mat.reserved + row.reserved);
    mat.free = roundQty(mat.free + row.free);
  }
  return materials;
}

/** Отчёт истории качеств: плоские события. */
export function qualityHistoryReport() {
  const history = store.readAll('quality_history');
  const materials = indexById(store.readAll('materials'));
  const lots = indexById(store.readAll('lots'));
  const users = indexById(store.readAll('users'));

  const rows = history.map((h) => {
    const lot = lots[h.lotId];
    const materialId = h.materialId || lot?.materialId || '';
    const material = materials[materialId];
    const user = h.userId ? users[h.userId] : null;
    return {
      id: h.id,
      at: h.at || '',
      action: h.action || '',
      actionLabel: ACTION_LABEL[h.action] || h.action || '—',
      documentId: h.documentId || '',
      documentNumber: h.documentNumber || '—',
      documentType: h.documentType || '',
      documentStatus: h.documentStatus || '',
      materialId: materialId || 'none',
      materialName: material?.name || materialId || '—',
      materialType: material?.type || '—',
      unit: material?.unit || '',
      lotId: h.lotId || '',
      lotNumber: lot?.number || h.lotId || '—',
      qualityId: h.qualityId || '',
      qualityName: h.qualityName || '—',
      permission: h.permission || '',
      permissionLabel: h.permissionLabel || labelLotQualityPermission(h.permission),
      userId: h.userId || '',
      userName: user?.name || user?.login || h.userId || '—',
    };
  });

  rows.sort(
    (a, b) =>
      a.materialName.localeCompare(b.materialName, 'ru') ||
      a.lotNumber.localeCompare(b.lotNumber, 'ru', { numeric: true }) ||
      String(b.at).localeCompare(String(a.at))
  );
  return rows;
}

export function filterQualityHistoryReport(rows, ids) {
  if (!Array.isArray(ids) || !ids.length) return rows;
  const set = new Set(ids.map(String));
  return rows.filter((r) => set.has(String(r.id)));
}

export function groupQualityHistoryRows(rows) {
  const materials = [];
  const matMap = new Map();
  for (const row of rows) {
    let mat = matMap.get(row.materialId);
    if (!mat) {
      mat = {
        id: row.materialId,
        name: row.materialName,
        type: row.materialType,
        unit: row.unit,
        lots: [],
      };
      matMap.set(row.materialId, mat);
      materials.push(mat);
    }
    let lot = mat.lots.find((l) => l.id === row.lotId);
    if (!lot) {
      lot = {
        id: row.lotId,
        lotNumber: row.lotNumber,
        events: [],
      };
      mat.lots.push(lot);
    }
    lot.events.push(row);
  }
  for (const mat of materials) {
    for (const lot of mat.lots) {
      lot.events.sort((a, b) => String(b.at).localeCompare(String(a.at)));
    }
  }
  return materials;
}
