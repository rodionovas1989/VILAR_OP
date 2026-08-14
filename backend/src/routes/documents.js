import { Router } from 'express';
import * as documents from '../services/documents.js';
import { DOCUMENT_TYPES, DOCUMENT_STATUS, assertDocumentType } from '../constants/documentTypes.js';

const router = Router();

router.get('/meta/types', (_req, res) => {
  res.json({
    types: Object.entries(DOCUMENT_TYPES).map(([id, m]) => ({ id, ...m })),
    statuses: DOCUMENT_STATUS,
  });
});

function parseType(req, res, next) {
  try {
    req.docType = assertDocumentType(req.params.type);
    next();
  } catch (e) {
    res.status(400).json({ error: e.message || String(e) });
  }
}

router.get('/:type', parseType, (req, res) => {
  res.json(
    documents.listDocuments(req.docType, {
      status: req.query.status,
      productionOrderId: req.query.productionOrderId,
    })
  );
});

router.get('/:type/:id', parseType, (req, res) => {
  const doc = documents.getDocument(req.docType, req.params.id);
  if (!doc) return res.status(404).json({ error: 'Не найдено' });
  res.json(doc);
});

router.post('/:type', parseType, (req, res) => {
  try {
    res.status(201).json(documents.createDocument(req.docType, req.body));
  } catch (e) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

router.put('/:type/:id', parseType, (req, res) => {
  try {
    res.json(documents.updateDocument(req.docType, req.params.id, req.body));
  } catch (e) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

router.delete('/:type/:id', parseType, (req, res) => {
  try {
    res.json(documents.deleteDocument(req.docType, req.params.id));
  } catch (e) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

router.post('/:type/:id/post', parseType, (req, res) => {
  try {
    const userId = req.body?.userId;
    res.json(documents.postDocument(req.docType, req.params.id, userId));
  } catch (e) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

router.post('/:type/:id/repost', parseType, (req, res) => {
  try {
    const { userId, ...patch } = req.body || {};
    res.json(documents.repostDocument(req.docType, req.params.id, userId, patch));
  } catch (e) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

router.post('/:type/:id/cancel', parseType, (req, res) => {
  try {
    const userId = req.body?.userId;
    res.json(documents.cancelDocument(req.docType, req.params.id, userId));
  } catch (e) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

router.post('/:type/:id/fulfill', parseType, (req, res) => {
  try {
    const userId = req.body?.userId;
    res.json(
      documents.fulfillDocument(req.docType, req.params.id, userId, {
        basisDocumentId: req.body?.basisDocumentId,
        basisDocumentNumber: req.body?.basisDocumentNumber,
      })
    );
  } catch (e) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

export default router;
