import * as store from '../store.js';
import { DOCUMENT_TYPES } from '../constants/documentTypes.js';
import { resolveLotQuality } from './quality.js';

const DOC_STATUS = {
  draft: 'Создан',
  posted: 'Проведён',
  cancelled: 'Отменён',
  fulfilled: 'Выполнен',
};

const RES_ACTION = {
  post: 'Резерв',
  cancel: 'Снятие резерва',
  fulfill: 'Исполнение резерва',
};

const QTY_KIND = {
  receipt: 'Приход',
  issue: 'Расход',
};

function indexById(rows) {
  const map = {};
  for (const row of rows) map[row.id] = row;
  return map;
}

function roundQty(n) {
  return Number(Number(n || 0).toFixed(6));
}

function localParts(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    const raw = String(iso || '');
    return { day: raw.slice(0, 10), time: raw.slice(11, 16) || '—' };
  }
  const pad = (n) => String(n).padStart(2, '0');
  return {
    day: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

function docTypeLabel(type) {
  return DOCUMENT_TYPES[type]?.label || type || '—';
}

function hasScope(query) {
  return Boolean(
    query.from ||
      query.to ||
      query.materialId ||
      query.warehouseId ||
      query.seriesId ||
      query.lotId ||
      query.lotQuery ||
      query.documentNumber
  );
}

function lotBlob(lot) {
  return `${lot?.number || ''} ${lot?.identificationNumber || ''}`.toLowerCase();
}

/**
 * Журнал движений запасов для расследования.
 * Бегущий остаток считается по всей истории партии на складе, затем строки режутся отбором.
 * Без периода и без других отборов журнал целиком не отдаётся.
 */
export function stockMovementReport(raw = {}) {
  const query = {
    from: raw.from ? String(raw.from).slice(0, 10) : '',
    to: raw.to ? String(raw.to).slice(0, 10) : '',
    materialId: String(raw.materialId || ''),
    warehouseId: String(raw.warehouseId || ''),
    seriesId: String(raw.seriesId || ''),
    lotId: String(raw.lotId || ''),
    lotQuery: String(raw.lotQuery || '').trim().toLowerCase(),
    documentNumber: String(raw.documentNumber || '').trim().toLowerCase(),
  };

  if (!hasScope(query)) {
    return { needsFilter: true, rows: [], lot: null, lotMatches: [] };
  }

  const materials = indexById(store.readAll('materials'));
  const lots = indexById(store.readAll('lots'));
  const warehouses = indexById(store.readAll('warehouses'));
  const seriesMap = indexById(store.readAll('series'));
  const orders = indexById(store.readAll('production_orders'));
  const counterparties = indexById(store.readAll('counterparties'));
  const manufacturers = indexById(store.readAll('manufacturers'));

  const balance = {};
  const rows = [];
  const sorted = [...store.readAll('material_movements')].sort(
    (a, b) => String(a.at).localeCompare(String(b.at)) || String(a.id).localeCompare(String(b.id))
  );

  for (const m of sorted) {
    const lot = lots[m.lotId];
    const materialId = m.materialId || lot?.materialId || '';
    const material = materials[materialId];
    const warehouse = warehouses[m.warehouseId];
    const series = m.seriesId ? seriesMap[m.seriesId] : null;
    const order = m.productionOrderId ? orders[m.productionOrderId] : null;
    const orderSeries = order?.seriesId ? seriesMap[order.seriesId] : null;
    const key = `${m.warehouseId || ''}|${m.lotId || ''}`;
    const next = roundQty((balance[key] || 0) + Number(m.quantity || 0));
    balance[key] = next;
    const when = localParts(m.at);
    rows.push({
      id: m.id,
      at: m.at,
      day: when.day,
      time: when.time,
      documentId: m.documentId || '',
      documentNumber: m.documentNumber || '—',
      documentType: m.documentType || '',
      documentTypeLabel: docTypeLabel(m.documentType),
      documentStatus: m.documentStatus || '',
      documentStatusLabel: DOC_STATUS[m.documentStatus] || m.documentStatus || '—',
      warehouseId: m.warehouseId || '',
      warehouseName: warehouse?.name || '—',
      materialId,
      materialName: material?.name || materialId || '—',
      unit: material?.unit || '',
      lotId: m.lotId || '',
      lotNumber: lot?.number || m.lotId || '—',
      identificationNumber: String(lot?.identificationNumber || '').trim() || '—',
      seriesId: m.seriesId || '',
      seriesNumber: series?.number || '—',
      productionOrderId: m.productionOrderId || '',
      orderLabel: orderSeries?.number || '—',
      quantity: roundQty(m.quantity),
      kindLabel: QTY_KIND[m.type] || m.type || '—',
      balanceAfter: next,
    });
  }

  const filtered = rows.filter((r) => {
    if (query.from && r.day < query.from) return false;
    if (query.to && r.day > query.to) return false;
    if (query.materialId && r.materialId !== query.materialId) return false;
    if (query.warehouseId && r.warehouseId !== query.warehouseId) return false;
    if (query.seriesId && r.seriesId !== query.seriesId) return false;
    if (query.lotId && r.lotId !== query.lotId) return false;
    if (query.lotQuery) {
      const blob = `${r.lotNumber} ${r.identificationNumber}`.toLowerCase();
      if (!blob.includes(query.lotQuery)) return false;
    }
    if (query.documentNumber && !String(r.documentNumber).toLowerCase().includes(query.documentNumber)) return false;
    return true;
  });

  filtered.sort((a, b) => String(b.at).localeCompare(String(a.at)) || String(b.id).localeCompare(String(a.id)));

  const lotPick = pickLots(lots, materials, query);
  const lot = lotPick.lotId ? buildLotCard(lotPick.lotId, { lots, materials, warehouses, counterparties, manufacturers }) : null;

  return {
    needsFilter: false,
    rows: filtered,
    lot,
    lotMatches: lot ? [] : lotPick.matches,
  };
}

function pickLots(lots, materials, query) {
  if (query.lotId && lots[query.lotId]) return { lotId: query.lotId, matches: [] };
  if (!query.lotQuery) return { lotId: '', matches: [] };
  const matches = Object.values(lots)
    .filter((lot) => lotBlob(lot).includes(query.lotQuery))
    .slice(0, 30)
    .map((lot) => ({
      id: lot.id,
      number: lot.number || lot.id,
      identificationNumber: String(lot.identificationNumber || '').trim() || '—',
      materialName: materials[lot.materialId]?.name || lot.materialId || '—',
    }));
  if (matches.length === 1) return { lotId: matches[0].id, matches: [] };
  return { lotId: '', matches };
}

function buildLotCard(lotId, ctx) {
  const lot = ctx.lots[lotId];
  if (!lot) return null;
  const material = ctx.materials[lot.materialId];
  const quality = resolveLotQuality(lotId);
  const stock = store
    .readAll('stock')
    .filter((s) => s.lotId === lotId)
    .map((s) => ({
      warehouseId: s.warehouseId || '',
      warehouseName: ctx.warehouses[s.warehouseId]?.name || '—',
      quantity: roundQty(s.quantity),
    }))
    .sort((a, b) => a.warehouseName.localeCompare(b.warehouseName, 'ru'));

  const resDocs = indexById(store.readAll('reservation_documents'));
  const reservations = store
    .readAll('active_reservations')
    .filter((r) => r.lotId === lotId)
    .map((r) => ({
      id: r.id,
      warehouseName: ctx.warehouses[r.warehouseId]?.name || '—',
      quantity: roundQty(r.quantity),
      documentNumber: resDocs[r.documentId]?.number || '—',
      documentTypeLabel: 'Резервирование',
    }));

  const reservationHistory = store
    .readAll('reservation_history')
    .filter((r) => r.lotId === lotId)
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))
    .slice(0, 100)
    .map((r) => {
      const when = localParts(r.at);
      return {
        id: r.id,
        day: when.day,
        time: when.time,
        actionLabel: RES_ACTION[r.action] || r.action || '—',
        quantity: roundQty(r.quantity),
        documentNumber: r.documentNumber || '—',
        documentTypeLabel: docTypeLabel(r.documentType),
      };
    });

  return {
    id: lot.id,
    materialId: lot.materialId || '',
    number: lot.number || lot.id,
    identificationNumber: String(lot.identificationNumber || '').trim() || '—',
    materialName: material?.name || lot.materialId || '—',
    unit: material?.unit || '',
    counterpartyName: (lot.counterpartyId && ctx.counterparties[lot.counterpartyId]?.name) || '—',
    manufacturerName: (lot.manufacturerId && ctx.manufacturers[lot.manufacturerId]?.name) || '—',
    qualityName: quality.qualityName || quality.permissionLabel || '—',
    qualityDefaulted: Boolean(quality.defaulted),
    stock,
    reservations,
    reservationHistory,
  };
}

export function filterStockMovementRows(rows, ids) {
  if (!Array.isArray(ids) || !ids.length) return rows;
  const set = new Set(ids.map(String));
  return rows.filter((r) => set.has(String(r.id)));
}
