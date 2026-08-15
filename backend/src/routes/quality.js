import { Router } from 'express';
import * as quality from '../services/quality.js';
import { readAll } from '../store.js';
import { actorId, requirePermission } from '../middleware/access.js';
import { LOT_QUALITY_PERMISSIONS, QUALITY_MANAGEMENT_TYPE } from '../constants/lotQuality.js';

const router = Router();

router.get('/meta', requirePermission('quality_documents', 'read'), (_req, res) => {
  res.json({
    type: QUALITY_MANAGEMENT_TYPE,
    permissions: Object.values(LOT_QUALITY_PERMISSIONS),
    statuses: quality.QUALITY_DOCUMENT_STATUS,
  });
});

router.get('/meta/types', requirePermission('quality_documents', 'read'), (_req, res) => {
  res.json({
    types: Object.entries(quality.QUALITY_DOCUMENT_TYPES).map(([id, m]) => ({ id, ...m })),
    statuses: quality.QUALITY_DOCUMENT_STATUS,
    permissions: Object.values(LOT_QUALITY_PERMISSIONS),
  });
});

router.get('/documents', requirePermission('quality_documents', 'read'), (req, res) => {
  res.json(quality.listQualityDocuments({ status: req.query.status }));
});

router.get('/documents/:id', requirePermission('quality_documents', 'read'), (req, res) => {
  const doc = quality.getQualityDocument(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Не найдено' });
  res.json(doc);
});

router.get('/documents/:id/related', requirePermission('quality_documents', 'read'), (req, res) => {
  const trace = quality.getQualityDocumentTrace(req.params.id);
  if (!trace) return res.status(404).json({ error: 'Не найдено' });
  res.json(trace);
});

router.post('/documents', requirePermission('quality_documents', 'create'), (req, res) => {
  try {
    const body = { ...req.body, createdByUserId: actorId(req) || req.body?.createdByUserId };
    res.status(201).json(quality.createQualityDocument(body));
  } catch (e) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

router.put('/documents/:id', requirePermission('quality_documents', 'create'), (req, res) => {
  try {
    res.json(quality.updateQualityDocument(req.params.id, req.body));
  } catch (e) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

router.post('/documents/:id/post', requirePermission('quality_documents', 'create'), (req, res) => {
  try {
    res.json(quality.postQualityDocument(req.params.id, actorId(req)));
  } catch (e) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

router.post('/documents/:id/cancel', requirePermission('quality_documents', 'create'), (req, res) => {
  try {
    res.json(quality.cancelQualityDocument(req.params.id, actorId(req)));
  } catch (e) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

router.get('/register', requirePermission('quality_register', 'read'), (_req, res) => {
  res.json(readAll('quality_register'));
});

router.get('/history', requirePermission('quality_history', 'read'), (_req, res) => {
  res.json(readAll('quality_history'));
});

router.get('/lot/:lotId', requirePermission('quality_register', 'read'), (req, res) => {
  res.json(quality.resolveLotQuality(req.params.lotId));
});

export default router;
