import { Router } from 'express';
import * as characteristics from '../services/characteristics.js';
import { readAll } from '../store.js';
import { actorId, requirePermission } from '../middleware/access.js';
import {
  CHARACTERISTIC_MANAGEMENT_TYPE,
  CHARACTERISTIC_DOCUMENT_STATUS,
} from '../constants/lotCharacteristics.js';

const router = Router();

router.get('/meta', requirePermission('characteristic_documents', 'read'), (_req, res) => {
  res.json({
    type: CHARACTERISTIC_MANAGEMENT_TYPE,
    statuses: CHARACTERISTIC_DOCUMENT_STATUS,
  });
});

router.get(
  '/applicable/:materialId',
  requirePermission('characteristic_documents', 'read'),
  (req, res) => {
    res.json(characteristics.applicableCharacteristics(req.params.materialId));
  }
);

router.get('/documents', requirePermission('characteristic_documents', 'read'), (req, res) => {
  res.json(characteristics.listCharacteristicDocuments({ status: req.query.status }));
});

router.get('/documents/:id', requirePermission('characteristic_documents', 'read'), (req, res) => {
  const doc = characteristics.getCharacteristicDocument(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Не найдено' });
  res.json(doc);
});

router.get('/documents/:id/related', requirePermission('characteristic_documents', 'read'), (req, res) => {
  const trace = characteristics.getCharacteristicDocumentTrace(req.params.id);
  if (!trace) return res.status(404).json({ error: 'Не найдено' });
  res.json(trace);
});

router.post('/documents', requirePermission('characteristic_documents', 'create'), (req, res) => {
  try {
    const body = { ...req.body, createdByUserId: actorId(req) || req.body?.createdByUserId };
    res.status(201).json(characteristics.createCharacteristicDocument(body));
  } catch (e) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

router.put('/documents/:id', requirePermission('characteristic_documents', 'create'), (req, res) => {
  try {
    res.json(characteristics.updateCharacteristicDocument(req.params.id, req.body));
  } catch (e) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

router.post('/documents/:id/post', requirePermission('characteristic_documents', 'create'), (req, res) => {
  try {
    res.json(characteristics.postCharacteristicDocument(req.params.id, actorId(req)));
  } catch (e) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

router.post('/documents/:id/cancel', requirePermission('characteristic_documents', 'create'), (req, res) => {
  try {
    res.json(characteristics.cancelCharacteristicDocument(req.params.id, actorId(req)));
  } catch (e) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

router.get('/register', requirePermission('characteristic_register', 'read'), (_req, res) => {
  res.json(readAll('characteristic_register'));
});

router.get('/history', requirePermission('characteristic_history', 'read'), (_req, res) => {
  res.json(readAll('characteristic_history'));
});

export default router;
