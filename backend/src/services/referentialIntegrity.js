import * as store from '../store.js';
import { ALL_DOCUMENT_COLLECTIONS, DOCUMENT_TYPES } from '../constants/documentTypes.js';

const COLLECTION_LABELS = {
  materials: 'Материалы',
  lots: 'Партии',
  series: 'Серии',
  warehouses: 'Склады',
  counterparties: 'Контрагенты',
  work_centers: 'Рабочие центры',
  tech_maps: 'Технологические карты',
  specifications: 'Спецификации',
  planned_series_volumes: 'Плановые объёмы серий',
  substitutions: 'Аналоги',
  lot_qualities: 'Качества партий',
  lot_characteristics: 'Характеристики партий',
  production_orders: 'Заказы на производство',
  stock: 'Запасы',
  active_reservations: 'Регистр резервов',
  reservation_history: 'История резервов',
  material_movements: 'Движение материалов',
  quality_documents: 'Управление качеством',
  quality_register: 'Качества партий (состояние)',
  quality_history: 'Качества партий (история)',
  characteristic_documents: 'Управление характеристиками',
  characteristic_register: 'Характеристики партий (состояние)',
  characteristic_history: 'Характеристики партий (история)',
  ...Object.fromEntries(
    Object.entries(DOCUMENT_TYPES).map(([type, meta]) => [meta.collection, meta.label])
  ),
};

function labelOf(collection) {
  return COLLECTION_LABELS[collection] || collection;
}

function sampleOf(row, collection) {
  if (!row) return null;
  if (row.number) return String(row.number);
  if (row.name) return String(row.name);
  if (collection === 'production_orders' && row.id) return String(row.id).slice(0, 8);
  if (row.id) return String(row.id).slice(0, 8);
  return null;
}

function pushHit(map, collection, row) {
  if (!map.has(collection)) map.set(collection, { count: 0, samples: [] });
  const hit = map.get(collection);
  hit.count += 1;
  const sample = sampleOf(row, collection);
  if (sample && hit.samples.length < 5 && !hit.samples.includes(sample)) {
    hit.samples.push(sample);
  }
}

function rowHasId(row, id, fieldKeys) {
  for (const key of fieldKeys) {
    if (row[key] === id) return true;
  }
  return false;
}

function linesHaveId(row, id, lineKeys) {
  const lines = Array.isArray(row.lines) ? row.lines : [];
  const actual = Array.isArray(row.actualLines) ? row.actualLines : [];
  for (const line of [...lines, ...actual]) {
    for (const key of lineKeys) {
      if (line?.[key] === id) return true;
    }
  }
  return false;
}

function scanSimple(map, collection, id, fieldKeys) {
  for (const row of store.readAll(collection)) {
    if (rowHasId(row, id, fieldKeys)) pushHit(map, collection, row);
  }
}

function scanDocs(map, id, { headerKeys = [], lineKeys = [] } = {}) {
  for (const collection of [...ALL_DOCUMENT_COLLECTIONS, 'quality_documents', 'characteristic_documents']) {
    for (const row of store.readAll(collection)) {
      const hitHeader = headerKeys.length ? rowHasId(row, id, headerKeys) : false;
      const hitLines = lineKeys.length ? linesHaveId(row, id, lineKeys) : false;
      if (hitHeader || hitLines) pushHit(map, collection, row);
    }
  }
}

function scanSubstitutions(map, id, kind) {
  for (const row of store.readAll('substitutions')) {
    if (kind === 'materials') {
      if (row.baseMaterialId === id) {
        pushHit(map, 'substitutions', row);
        continue;
      }
      if (linesHaveId(row, id, ['materialId'])) pushHit(map, 'substitutions', row);
    } else if (kind === 'specifications' && row.specificationId === id) {
      pushHit(map, 'substitutions', row);
    }
  }
}

function scanSpecifications(map, id, kind) {
  for (const row of store.readAll('specifications')) {
    if (kind === 'materials') {
      if (row.productMaterialId === id) {
        pushHit(map, 'specifications', row);
        continue;
      }
      if (linesHaveId(row, id, ['materialId'])) {
        pushHit(map, 'specifications', row);
        continue;
      }
      const suppliers = Array.isArray(row.approvedSuppliers) ? row.approvedSuppliers : [];
      if (suppliers.some((s) => s?.materialId === id)) pushHit(map, 'specifications', row);
    } else if (kind === 'counterparties') {
      const suppliers = Array.isArray(row.approvedSuppliers) ? row.approvedSuppliers : [];
      if (suppliers.some((s) => s?.counterpartyId === id)) pushHit(map, 'specifications', row);
    }
  }
}

function scanProductionOrders(map, id, kind) {
  for (const row of store.readAll('production_orders')) {
    if (kind === 'materials' && row.materialId === id) {
      pushHit(map, 'production_orders', row);
      continue;
    }
    if (kind === 'series' && row.seriesId === id) {
      pushHit(map, 'production_orders', row);
      continue;
    }
    if (kind === 'work_centers' && row.workCenterId === id) {
      pushHit(map, 'production_orders', row);
      continue;
    }
    if (kind === 'specifications' && row.specificationId === id) {
      pushHit(map, 'production_orders', row);
      continue;
    }
    if (kind === 'materials' || kind === 'lots') {
      const keys = kind === 'materials' ? ['materialId'] : ['lotId'];
      if (linesHaveId(row, id, keys)) pushHit(map, 'production_orders', row);
    }
  }
}

/** Где используется объект справочника. Возвращает [{ label, count, samples }] */
export function findUsages(collection, id) {
  const map = new Map();

  switch (collection) {
    case 'materials':
      scanSimple(map, 'lots', id, ['materialId']);
      scanSimple(map, 'series', id, ['materialId']);
      scanSimple(map, 'planned_series_volumes', id, ['materialId']);
      scanSimple(map, 'stock', id, ['materialId']);
      scanSimple(map, 'material_movements', id, ['materialId']);
      scanSimple(map, 'active_reservations', id, ['materialId']);
      scanSimple(map, 'reservation_history', id, ['materialId']);
      scanSimple(map, 'quality_register', id, ['materialId']);
      scanSimple(map, 'quality_history', id, ['materialId']);
      scanSimple(map, 'characteristic_register', id, ['materialId']);
      scanSimple(map, 'characteristic_history', id, ['materialId']);
      scanSpecifications(map, id, 'materials');
      scanSubstitutions(map, id, 'materials');
      scanProductionOrders(map, id, 'materials');
      scanDocs(map, id, { lineKeys: ['materialId'] });
      for (const ch of store.readAll('lot_characteristics')) {
        if ((ch.materialIds || []).includes(id)) pushHit(map, 'lot_characteristics', ch);
      }
      break;

    case 'lots':
      scanSimple(map, 'stock', id, ['lotId']);
      scanSimple(map, 'material_movements', id, ['lotId']);
      scanSimple(map, 'active_reservations', id, ['lotId']);
      scanSimple(map, 'reservation_history', id, ['lotId']);
      scanSimple(map, 'quality_register', id, ['lotId']);
      scanSimple(map, 'quality_history', id, ['lotId']);
      scanSimple(map, 'characteristic_register', id, ['lotId']);
      scanSimple(map, 'characteristic_history', id, ['lotId']);
      scanProductionOrders(map, id, 'lots');
      scanDocs(map, id, { lineKeys: ['lotId'] });
      break;

    case 'series':
      scanProductionOrders(map, id, 'series');
      scanSimple(map, 'active_reservations', id, ['seriesId']);
      scanSimple(map, 'reservation_history', id, ['seriesId']);
      scanSimple(map, 'material_movements', id, ['seriesId']);
      scanDocs(map, id, { headerKeys: ['seriesId'] });
      break;

    case 'warehouses':
      scanSimple(map, 'stock', id, ['warehouseId']);
      scanSimple(map, 'material_movements', id, ['warehouseId']);
      scanSimple(map, 'active_reservations', id, ['warehouseId']);
      scanDocs(map, id, {
        headerKeys: ['warehouseId', 'warehouseFromId', 'warehouseToId'],
      });
      break;

    case 'counterparties':
      scanSimple(map, 'lots', id, ['counterpartyId']);
      scanSpecifications(map, id, 'counterparties');
      break;

    case 'work_centers':
      scanProductionOrders(map, id, 'work_centers');
      scanSimple(map, 'planned_series_volumes', id, ['workCenterId']);
      scanSimple(map, 'tech_maps', id, ['workCenterId']);
      break;

    case 'tech_maps':
      scanSimple(map, 'specifications', id, ['techMapId']);
      break;

    case 'specifications':
      scanProductionOrders(map, id, 'specifications');
      scanSubstitutions(map, id, 'specifications');
      break;

    case 'substitutions':
      break;

    case 'planned_series_volumes':
      // объёмы сами по себе не блокируют удаление по ссылкам наружу
      break;

    case 'lot_qualities':
      scanSimple(map, 'quality_register', id, ['qualityId']);
      scanSimple(map, 'quality_history', id, ['qualityId']);
      scanDocs(map, id, { lineKeys: ['qualityId'] });
      break;

    case 'lot_characteristics':
      scanSimple(map, 'characteristic_register', id, ['characteristicId']);
      scanSimple(map, 'characteristic_history', id, ['characteristicId']);
      for (const doc of store.readAll('characteristic_documents')) {
        const hit = (doc.lines || []).some((line) =>
          (line.values || []).some((v) => v.characteristicId === id)
        );
        if (hit) pushHit(map, 'characteristic_documents', doc);
      }
      break;

    default:
      break;
  }

  return [...map.entries()]
    .map(([col, hit]) => ({
      collection: col,
      label: labelOf(col),
      count: hit.count,
      samples: hit.samples,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'ru'));
}

function formatUsagesMessage(collection, id, usages) {
  const entity = labelOf(collection);
  const row = store.getById(collection, id);
  const name = row?.name || row?.number || id;
  const lines = usages.map((u) => {
    const samples = u.samples.length ? ` (${u.samples.join(', ')}${u.count > u.samples.length ? '…' : ''})` : '';
    return `• ${u.label}: ${u.count}${samples}`;
  });
  return [
    `Нельзя удалить «${name}» (${entity}): объект используется.`,
    'Места использования:',
    ...lines,
  ].join('\n');
}

/** Бросает Error, если хотя бы один id нельзя удалить. */
export function assertCanDelete(collection, ids) {
  const list = [...new Set((ids || []).filter(Boolean).map(String))];
  if (!list.length) return;

  if (collection === 'lot_characteristics') {
    for (const id of list) {
      const row = store.getById(collection, id);
      if (row?.kind === 'system') throw new Error('Системную характеристику нельзя удалить');
    }
  }

  const blocked = [];
  for (const id of list) {
    const usages = findUsages(collection, id);
    if (usages.length) blocked.push({ id, usages });
  }
  if (!blocked.length) return;

  if (blocked.length === 1) {
    throw new Error(formatUsagesMessage(collection, blocked[0].id, blocked[0].usages));
  }

  const parts = blocked.map((b) => {
    const row = store.getById(collection, b.id);
    const name = row?.name || row?.number || b.id;
    const places = b.usages.map((u) => `${u.label} (${u.count})`).join(', ');
    return `• ${name}: ${places}`;
  });
  throw new Error(
    `Нельзя удалить выбранные объекты (${labelOf(collection)}): есть ссылки.\n${parts.join('\n')}`
  );
}

export function isProtectedDictionary(collection) {
  return [
    'materials',
    'lots',
    'series',
    'warehouses',
    'counterparties',
    'work_centers',
    'tech_maps',
    'specifications',
    'lot_qualities',
    'lot_characteristics',
  ].includes(collection);
}
