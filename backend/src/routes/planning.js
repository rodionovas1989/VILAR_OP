import { Router } from 'express';
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

router.post('/cancel/:id', (req, res) => {
  try {
    res.json(planning.cancelOrder(req.params.id));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/gantt', (_req, res) => {
  const orders = store.readAll('production_orders').filter((o) => o.status !== 'отменен');
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

export default router;
