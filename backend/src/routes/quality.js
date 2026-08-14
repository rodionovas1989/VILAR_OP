import { Router } from 'express';
import { readAll } from '../store.js';
import * as quality from '../services/quality.js';

const router = Router();

router.get('/meta/types', (_req, res) => {
  res.json({
    types: Object.entries(quality.QUALITY_DOCUMENT_TYPES).map(([id, m]) => ({ id, ...m })),
    statuses: quality.QUALITY_DOCUMENT_STATUS,
  });
});

router.get('/documents', (req, res) => {
  res.json(
    quality.listQualityDocuments({
      type: req.query.type,
      status: req.query.status,
    })
  );
});

router.get('/documents/:id', (req, res) => {
  const doc = quality.getQualityDocument(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Не найдено' });
  res.json(doc);
});

router.post('/documents', (req, res) => {
  try {
    res.status(201).json(quality.createQualityDocument(req.body));
  } catch (e) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

router.put('/documents/:id', (req, res) => {
  try {
    res.json(quality.updateQualityDocument(req.params.id, req.body));
  } catch (e) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

router.post('/documents/:id/post', (req, res) => {
  try {
    res.json(quality.postQualityDocument(req.params.id, req.body?.userId));
  } catch (e) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

router.post('/documents/:id/cancel', (req, res) => {
  try {
    res.json(quality.cancelQualityDocument(req.params.id, req.body?.userId));
  } catch (e) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

router.get('/register', (_req, res) => {
  res.json(readAll('quality_register'));
});

router.get('/history', (_req, res) => {
  res.json(readAll('quality_history'));
});

export default router;
