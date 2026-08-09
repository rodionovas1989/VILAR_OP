import { Router } from 'express';
import ExcelJS from 'exceljs';
import * as planning from '../services/planning.js';
import * as store from '../store.js';

const router = Router();

router.post('/select-orders', (req, res) => {
  try {
    const ids = req.body?.ids || [];
    res.json(planning.confirmOrderSelection(ids));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/suggest-materials', (req, res) => {
  try {
    const { orderId, algorithm = 'FEFO' } = req.body || {};
    res.json(planning.suggestPicksForOrder(orderId, algorithm));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/suggest-materials-bulk', (req, res) => {
  try {
    const { orderIds = [], algorithm = 'FEFO' } = req.body || {};
    const result = orderIds.map((orderId) => planning.suggestPicksForOrder(orderId, algorithm));
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/confirm-materials', (req, res) => {
  try {
    const { orderId, picks } = req.body || {};
    res.json(planning.confirmMaterialPicks(orderId, picks));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/confirm-materials-bulk', (req, res) => {
  try {
    const { items = [] } = req.body || {};
    const out = items.map(({ orderId, picks }) => planning.confirmMaterialPicks(orderId, picks));
    res.json(out);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/complete/:id', (req, res) => {
  try {
    res.json(planning.completeOrder(req.params.id));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/production-fact/:id', (req, res) => {
  try {
    res.json(
      planning.saveProductionFact(req.params.id, {
        actualQuantity: req.body?.actualQuantity,
        actualLines: req.body?.actualLines,
      })
    );
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/cancel/:id', (req, res) => {
  try {
    res.json(planning.cancelOrder(req.params.id));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/gantt', (_req, res) => {
  const orders = store.readAll('production_orders');
  const materials = store.readAll('materials');
  const series = store.readAll('series');
  const lots = store.readAll('lots');
  const cps = store.readAll('counterparties');
  const wcs = store.readAll('work_centers');
  const reservations = store.readAll('reservations');

  const tasks = orders.map((o) => {
    const mat = materials.find((m) => m.id === o.materialId);
    const ser = series.find((s) => s.id === o.seriesId);
    const wc = wcs.find((w) => w.id === o.workCenterId);
    const resLines = reservations
      .filter((r) => r.productionOrderId === o.id)
      .map((r) => {
        const rm = materials.find((m) => m.id === r.materialId);
        const lot = lots.find((l) => l.id === r.lotId);
        const cp = cps.find((c) => c.id === lot?.counterpartyId);
        return {
          material: rm?.name,
          lot: lot?.number,
          counterparty: cp?.name || '—',
          quantity: r.quantity,
        };
      });

    return {
      id: o.id,
      name: `${mat?.name || '—'} / ${ser?.number || '—'}`,
      start: o.startAt.slice(0, 10),
      end: o.endAt.slice(0, 10),
      startAt: o.startAt,
      endAt: o.endAt,
      progress: o.status === 'завершен' ? 100 : o.status === 'спланирован' ? 50 : 0,
      custom_class: `status-${o.status}`,
      workCenterId: o.workCenterId,
      workCenterName: wc?.name,
      status: o.status,
      product: mat?.name,
      series: ser?.number,
      reservations: resLines,
    };
  });

  res.json({ workCenters: wcs, tasks });
});

router.get('/lots-available/:materialId', (req, res) => {
  const algorithm = req.query.algorithm || 'FEFO';
  res.json(planning.availableLotsForMaterial(req.params.materialId, algorithm));
});

router.get('/material-balance-matrix', (req, res) => {
  try {
    res.json(
      planning.materialBalanceMatrix({
        from: req.query.from || undefined,
        to: req.query.to || undefined,
      })
    );
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/export-orders-materials.xlsx', async (req, res) => {
  try {
    const ids = req.body?.ids || [];
    if (!ids.length) return res.status(400).json({ error: 'Не выбраны заказы' });

    const materials = store.readAll('materials');
    const series = store.readAll('series');
    const lots = store.readAll('lots');
    const cps = store.readAll('counterparties');
    const wcs = store.readAll('work_centers');
    const orders = store
      .readAll('production_orders')
      .filter((o) => ids.includes(o.id))
      .sort((a, b) => String(a.startAt).localeCompare(String(b.startAt)));

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Заказы и материалы');
    ws.columns = [
      { header: 'Уровень', key: 'level', width: 12 },
      { header: 'Продукт / компонент', key: 'name', width: 40 },
      { header: 'Серия ГП', key: 'series', width: 18 },
      { header: 'Партия сырья', key: 'lot', width: 18 },
      { header: 'Контрагент', key: 'counterparty', width: 28 },
      { header: 'РЦ', key: 'wc', width: 14 },
      { header: 'Статус', key: 'status', width: 14 },
      { header: 'Начало', key: 'start', width: 20 },
      { header: 'Окончание', key: 'end', width: 20 },
      { header: 'Количество', key: 'qty', width: 14 },
    ];

    for (const o of orders) {
      const mat = materials.find((m) => m.id === o.materialId);
      const ser = series.find((s) => s.id === o.seriesId);
      const wc = wcs.find((w) => w.id === o.workCenterId);
      ws.addRow({
        level: 'Заказ',
        name: mat?.name || o.materialId,
        series: ser?.number || '',
        lot: '',
        counterparty: '',
        wc: wc?.name || '',
        status: o.status,
        start: o.startAt ? new Date(o.startAt).toLocaleString('ru-RU') : '',
        end: o.endAt ? new Date(o.endAt).toLocaleString('ru-RU') : '',
        qty: o.quantity,
      });
      for (const line of o.lines || []) {
        const cm = materials.find((m) => m.id === line.materialId);
        const lot = lots.find((l) => l.id === line.lotId);
        const cp = cps.find((c) => c.id === lot?.counterpartyId);
        ws.addRow({
          level: 'Компонент',
          name: cm?.name || line.materialId,
          series: ser?.number || '',
          lot: lot?.number || '',
          counterparty: cp?.name || '',
          wc: '',
          status: '',
          start: '',
          end: '',
          qty: line.quantity,
        });
      }
    }

    ws.getRow(1).font = { bold: true };
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="orders-materials.xlsx"');
    await wb.xlsx.write(res);
    res.end();
  } catch (e) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

export default router;
