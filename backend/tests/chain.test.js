import fs from 'fs';
import os from 'os';
import path from 'path';
import { after, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vilar-op-'));
process.env.VILAR_SQLITE_PATH = path.join(tmp, 'test.sqlite');
process.env.VILAR_SKIP_JSON_IMPORT = '1';

const store = await import('../src/store.js');
const documents = await import('../src/services/documents.js');
const planning = await import('../src/services/planning.js');

const USER = 'user-admin';
const WH_C = 'wh-components';
const WH_FG = 'wh-finished';

function isoDays(offset) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

function stockQty(lotId, warehouseId) {
  const row = store.readAll('stock').find((s) => s.lotId === lotId && s.warehouseId === warehouseId);
  return row ? Number(row.quantity) : 0;
}

function movementsFor(documentId) {
  return store.readAll('material_movements').filter((m) => m.documentId === documentId);
}

function seedWorld() {
  store.resetDatabase();
  store.ensureCollections();

  store.create('materials', { id: 'mat-rm', name: 'Сырьё А', type: 'основной компонент', unit: 'кг' });
  store.create('materials', { id: 'mat-gp', name: 'Препарат', type: 'продукт', unit: 'уп' });
  store.create('counterparties', { id: 'cp-1', name: 'Поставщик' });
  store.create('lots', {
    id: 'lot-rm',
    number: 'RM-001',
    materialId: 'mat-rm',
    counterpartyId: 'cp-1',
    productionDate: isoDays(-30),
    expiryDate: isoDays(365),
  });
  store.create('lots', {
    id: 'lot-rm-2',
    number: 'RM-002',
    materialId: 'mat-rm',
    counterpartyId: 'cp-1',
    productionDate: isoDays(-10),
    expiryDate: isoDays(200),
  });
  store.create('series', { id: 'ser-1', number: 'S-001', materialId: 'mat-gp' });
  store.create('work_centers', { id: 'wc-1', name: 'Линия 1' });
  store.create('specifications', {
    id: 'spec-1',
    name: 'Спец препарат',
    type: 'Основная',
    productMaterialId: 'mat-gp',
    qtyBasis: 'per1000',
    lines: [{ id: 'sl-1', materialId: 'mat-rm', qtyPerUnit: 2 }],
    approvedSuppliers: [{ counterpartyId: 'cp-1' }],
  });
  store.create('production_orders', {
    id: 'ord-1',
    materialId: 'mat-gp',
    seriesId: 'ser-1',
    specificationId: 'spec-1',
    workCenterId: 'wc-1',
    quantity: 1000,
    status: 'новый',
    startAt: `${isoDays(0)}T08:00:00.000Z`,
    endAt: `${isoDays(1)}T08:00:00.000Z`,
    lines: [],
    actualLines: [],
  });
}

function postReceipt(qty = 100, lotId = 'lot-rm') {
  const draft = documents.createDocument('receipt', {
    createdByUserId: USER,
    warehouseToId: WH_C,
    lines: [{ materialId: 'mat-rm', lotId, quantity: qty }],
  });
  return documents.postDocument('receipt', draft.id, USER);
}

beforeEach(() => {
  seedWorld();
});

after(() => {
  store.closeDb();
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('Приёмка и складские документы', () => {
  test('проведение приёмки увеличивает запас и пишет движение', () => {
    const posted = postReceipt(40);
    assert.equal(posted.status, 'posted');
    assert.equal(stockQty('lot-rm', WH_C), 40);
    const movs = movementsFor(posted.id);
    assert.equal(movs.length, 1);
    assert.equal(movs[0].type, 'receipt');
    assert.equal(movs[0].quantity, 40);
    assert.equal(movs[0].documentStatus, 'posted');
    assert.equal(movs[0].documentNumber, posted.number);
    assert.equal(movs[0].warehouseId, WH_C);
  });

  test('отмена приёмки откатывает запас и помечает движения cancelled', () => {
    const posted = postReceipt(15);
    documents.cancelDocument('receipt', posted.id, USER);
    assert.equal(stockQty('lot-rm', WH_C), 0);
    const movs = movementsFor(posted.id);
    assert.ok(movs.length >= 2);
    assert.ok(movs.every((m) => m.documentStatus === 'cancelled'));
  });

  test('перемещение пишет два движения и меняет склады', () => {
    postReceipt(20);
    const draft = documents.createDocument('transfer', {
      createdByUserId: USER,
      warehouseFromId: WH_C,
      warehouseToId: WH_FG,
      lines: [{ materialId: 'mat-rm', lotId: 'lot-rm', quantity: 5 }],
    });
    const posted = documents.postDocument('transfer', draft.id, USER);
    assert.equal(stockQty('lot-rm', WH_C), 15);
    assert.equal(stockQty('lot-rm', WH_FG), 5);
    const movs = movementsFor(posted.id);
    assert.equal(movs.length, 2);
    assert.ok(movs.some((m) => m.quantity === -5 && m.warehouseId === WH_C));
    assert.ok(movs.some((m) => m.quantity === 5 && m.warehouseId === WH_FG));
  });

  test('списание уменьшает запас; недостаток остатка запрещён', () => {
    postReceipt(8);
    const draft = documents.createDocument('writeoff', {
      createdByUserId: USER,
      warehouseFromId: WH_C,
      lines: [{ materialId: 'mat-rm', lotId: 'lot-rm', quantity: 3 }],
    });
    documents.postDocument('writeoff', draft.id, USER);
    assert.equal(stockQty('lot-rm', WH_C), 5);

    const tooMuch = documents.createDocument('writeoff', {
      createdByUserId: USER,
      warehouseFromId: WH_C,
      lines: [{ materialId: 'mat-rm', lotId: 'lot-rm', quantity: 99 }],
    });
    assert.throws(() => documents.postDocument('writeoff', tooMuch.id, USER), /Недостаточно/);
  });

  test('оприходование и отгрузка', () => {
    const pst = documents.createDocument('posting', {
      createdByUserId: USER,
      warehouseToId: WH_C,
      lines: [{ materialId: 'mat-rm', lotId: 'lot-rm', quantity: 12 }],
    });
    documents.postDocument('posting', pst.id, USER);
    assert.equal(stockQty('lot-rm', WH_C), 12);
    assert.equal(movementsFor(pst.id).length, 1);

    const shp = documents.createDocument('shipment', {
      createdByUserId: USER,
      warehouseFromId: WH_C,
      lines: [{ materialId: 'mat-rm', lotId: 'lot-rm', quantity: 4 }],
    });
    documents.postDocument('shipment', shp.id, USER);
    assert.equal(stockQty('lot-rm', WH_C), 8);
    assert.equal(movementsFor(shp.id).length, 1);
    assert.equal(movementsFor(shp.id)[0].type, 'issue');
  });

  test('инвентаризация пишет движение только при расхождении', () => {
    postReceipt(10);
    const same = documents.createDocument('inventory', {
      createdByUserId: USER,
      warehouseId: WH_C,
      lines: [{ materialId: 'mat-rm', lotId: 'lot-rm', quantity: 10, bookQuantity: 10, actualQuantity: 10 }],
    });
    documents.postDocument('inventory', same.id, USER);
    assert.equal(movementsFor(same.id).length, 0);
    assert.equal(stockQty('lot-rm', WH_C), 10);

    const plus = documents.createDocument('inventory', {
      createdByUserId: USER,
      warehouseId: WH_C,
      lines: [{ materialId: 'mat-rm', lotId: 'lot-rm', quantity: 12, bookQuantity: 10, actualQuantity: 12 }],
    });
    documents.postDocument('inventory', plus.id, USER);
    assert.equal(stockQty('lot-rm', WH_C), 12);
    assert.equal(movementsFor(plus.id).length, 1);
    assert.equal(movementsFor(plus.id)[0].quantity, 2);
  });
});

describe('Резерв и заказ', () => {
  test('подтверждение сырья создаёт RES posted без движения stock', () => {
    postReceipt(50);
    const { order, reservationDocument } = planning.confirmMaterialPicks(
      'ord-1',
      [{ materialId: 'mat-rm', lotId: 'lot-rm', quantity: 2 }],
      USER
    );
    assert.equal(order.status, 'спланирован');
    assert.equal(reservationDocument.status, 'posted');
    assert.equal(stockQty('lot-rm', WH_C), 50);
    assert.equal(movementsFor(reservationDocument.id).length, 0);
    const active = store.readAll('active_reservations').filter((r) => r.productionOrderId === 'ord-1');
    assert.equal(active.length, 1);
    assert.equal(active[0].quantity, 2);
    assert.equal(active[0].documentId, reservationDocument.id);
  });

  test('переплан отменяет старый RES и создаёт новый', () => {
    postReceipt(50);
    const first = planning.confirmMaterialPicks(
      'ord-1',
      [{ materialId: 'mat-rm', lotId: 'lot-rm', quantity: 2 }],
      USER
    );
    const second = planning.confirmMaterialPicks(
      'ord-1',
      [{ materialId: 'mat-rm', lotId: 'lot-rm', quantity: 2 }],
      USER
    );
    const old = documents.getDocument('reservation', first.reservationDocument.id);
    assert.equal(old.status, 'cancelled');
    assert.equal(second.reservationDocument.status, 'posted');
    const active = store.readAll('active_reservations').filter((r) => r.productionOrderId === 'ord-1');
    assert.equal(active.length, 1);
    assert.equal(active[0].documentId, second.reservationDocument.id);
  });

  test('GMP: две партии одного материала на заказ запрещены', () => {
    postReceipt(50);
    postReceipt(50, 'lot-rm-2');
    assert.throws(
      () =>
        planning.confirmMaterialPicks(
          'ord-1',
          [
            { materialId: 'mat-rm', lotId: 'lot-rm', quantity: 1 },
            { materialId: 'mat-rm', lotId: 'lot-rm-2', quantity: 1 },
          ],
          USER
        ),
      /GMP/
    );
  });

  test('отмена спланированного заказа отменяет RES', () => {
    postReceipt(50);
    const { reservationDocument } = planning.confirmMaterialPicks(
      'ord-1',
      [{ materialId: 'mat-rm', lotId: 'lot-rm', quantity: 2 }],
      USER
    );
    planning.cancelOrder('ord-1', USER);
    assert.equal(store.getById('production_orders', 'ord-1').status, 'отменен');
    assert.equal(documents.getDocument('reservation', reservationDocument.id).status, 'cancelled');
    assert.equal(store.readAll('active_reservations').filter((r) => r.productionOrderId === 'ord-1').length, 0);
  });
});

describe('Полная цепочка: приёмка → резерв → завершение', () => {
  test('completeOrder проводит PRI/PRR, закрывает RES и пишет движения', () => {
    postReceipt(50);
    planning.confirmMaterialPicks('ord-1', [{ materialId: 'mat-rm', lotId: 'lot-rm', quantity: 2 }], USER);

    const result = planning.completeOrder('ord-1', USER);
    assert.equal(result.order.status, 'завершен');
    assert.equal(result.documents.reservation.status, 'fulfilled');
    assert.equal(result.documents.productionIssue.status, 'posted');
    assert.equal(result.documents.productionReceipt.status, 'posted');

    const resFresh = documents.getDocument('reservation', result.documents.reservation.id);
    assert.equal(resFresh.status, 'fulfilled');
    assert.equal(store.readAll('active_reservations').filter((r) => r.productionOrderId === 'ord-1').length, 0);

    assert.equal(stockQty('lot-rm', WH_C), 48);
    const gpLot = store.readAll('lots').find((l) => l.number === 'ГП-S-001');
    assert.ok(gpLot);
    assert.equal(stockQty(gpLot.id, WH_FG), 1000);

    const priMovs = movementsFor(result.documents.productionIssue.id);
    assert.equal(priMovs.length, 1);
    assert.equal(priMovs[0].type, 'issue');
    assert.equal(priMovs[0].quantity, -2);

    const prrMovs = movementsFor(result.documents.productionReceipt.id);
    assert.equal(prrMovs.length, 1);
    assert.equal(prrMovs[0].type, 'receipt');
    assert.equal(prrMovs[0].quantity, 1000);

    const trace = documents.getDocumentTrace('reservation', resFresh.id);
    assert.equal(trace.relatedDocuments.some((d) => d.type === 'production_issue'), true);
    assert.equal(trace.productionOrder.status, 'завершен');
    assert.ok(trace.reservationHistory.some((h) => h.action === 'fulfill'));
  });

  test('отчёт выпущенных серий показывает ГП и фактические компоненты', async () => {
    postReceipt(50);
    planning.confirmMaterialPicks('ord-1', [{ materialId: 'mat-rm', lotId: 'lot-rm', quantity: 2 }], USER);
    planning.completeOrder('ord-1', USER);
    const { releasedSeriesReport } = await import('../src/services/reports.js');
    const rows = releasedSeriesReport();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].productName, 'Препарат');
    assert.equal(rows[0].seriesNumber, 'S-001');
    assert.equal(rows[0].quantity, 1000);
    assert.equal(rows[0].lotNumber.startsWith('ГП-'), true);
    assert.equal(rows[0].components.length, 1);
    assert.equal(rows[0].components[0].materialName, 'Сырьё А');
    assert.equal(rows[0].components[0].lotNumber, 'RM-001');
    assert.equal(rows[0].components[0].quantity, 2);
  });

  test('отчёт запасов группирует склад → материал → партия и учитывает резерв', async () => {
    postReceipt(50);
    planning.confirmMaterialPicks('ord-1', [{ materialId: 'mat-rm', lotId: 'lot-rm', quantity: 2 }], USER);
    const { stockReport, groupStockRows } = await import('../src/services/reports.js');
    const rows = stockReport();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].materialName, 'Сырьё А');
    assert.equal(rows[0].lotNumber, 'RM-001');
    assert.equal(rows[0].quantity, 50);
    assert.equal(rows[0].reserved, 2);
    assert.equal(rows[0].free, 48);
    const tree = groupStockRows(rows);
    assert.equal(tree.length, 1);
    assert.equal(tree[0].name, 'Склад компонентов');
    assert.equal(tree[0].quantity, 50);
    assert.equal(tree[0].materials[0].name, 'Сырьё А');
    assert.equal(tree[0].materials[0].lots[0].lotNumber, 'RM-001');
  });

  test('повторное завершение запрещено; отмена завершённого запрещена', () => {
    postReceipt(50);
    planning.confirmMaterialPicks('ord-1', [{ materialId: 'mat-rm', lotId: 'lot-rm', quantity: 2 }], USER);
    planning.completeOrder('ord-1', USER);
    assert.throws(() => planning.completeOrder('ord-1', USER), /статусе/);
    assert.throws(() => planning.cancelOrder('ord-1', USER), /статусе/);
  });

  test('завершение нового заказа запрещено', () => {
    postReceipt(50);
    assert.throws(() => planning.completeOrder('ord-1', USER), /статусе/);
  });

  test('трассировка приёмки показывает движение и текущий запас', () => {
    const posted = postReceipt(7);
    const trace = documents.getDocumentTrace('receipt', posted.id);
    assert.equal(trace.movements.length, 1);
    assert.equal(trace.stock.some((s) => s.lotId === 'lot-rm' && Number(s.quantity) === 7), true);
  });
});

describe('Обратная связь', () => {
  test('автор видит только свои обращения; модератор — все', async () => {
    const { createTicket, listTickets, updateTicket } = await import('../src/services/feedback.js');
    const author = { id: 'user-a', name: 'Кладовщик', login: 'store' };
    const admin = { id: USER, name: 'Admin', login: 'Admin' };

    createTicket(
      { category: 'улучшить', title: 'Фильтры', body: 'Сохранять отборы при переходах' },
      author
    );
    createTicket({ category: 'понравилось', title: 'Документы', body: 'Удобные карточки' }, admin);

    const mine = listTickets(author.id, false);
    assert.equal(mine.length, 1);
    assert.equal(mine[0].title, 'Фильтры');
    assert.equal(mine[0].status, 'новый');

    const all = listTickets(admin.id, true);
    assert.equal(all.length, 2);

    const updated = updateTicket(mine[0].id, { status: 'в работе', adminComment: 'Принято' }, admin, {
      seeAll: true,
      canModify: true,
    });
    assert.equal(updated.status, 'в работе');
    assert.equal(updated.adminComment, 'Принято');
  });
});
