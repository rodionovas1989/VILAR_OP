import { Router } from 'express';
import * as documents from '../services/documents.js';
import { DOCUMENT_TYPES, DOCUMENT_STATUS, assertDocumentType } from '../constants/documentTypes.js';
import { actorId, requireAnyPermission, requirePermission } from '../middleware/access.js';

const router = Router();

router.get(
  '/meta/types',
  requireAnyPermission(Object.keys(DOCUMENT_TYPES).map((id) => [`doc_${id}`, 'read'])),
  (_req, res) => {
    res.json({
      types: Object.entries(DOCUMENT_TYPES).map(([id, m]) => ({ id, ...m })),
      statuses: DOCUMENT_STATUS,
    });
  }
);

function parseType(req, res, next) {
  try {
    req.docType = assertDocumentType(req.params.type);
    next();
  } catch (e) {
    res.status(400).json({ error: e.message || String(e) });
  }
}

function requireDoc(level) {
  return (req, res, next) => requirePermission(`doc_${req.docType}`, level)(req, res, next);
}

/** Предзаполнение плана/факта INV по остаткам склада (до /:type/:id). */
router.get(
  '/inventory/stock-preview',
  requirePermission('doc_inventory', 'read'),
  (req, res) => {
    try {
      const warehouseId = req.query.warehouseId;
      if (!warehouseId) return res.status(400).json({ error: 'Укажите warehouseId' });
      res.json(documents.inventoryStockPreview(String(warehouseId)));
    } catch (e) {
      res.status(400).json({ error: e.message || String(e) });
    }
  }
);

router.get('/:type', parseType, requireDoc('read'), (req, res) => {
  res.json(
    documents.listDocuments(req.docType, {
      status: req.query.status,
      productionOrderId: req.query.productionOrderId,
    })
  );
});

router.get('/:type/:id/related', parseType, requireDoc('read'), (req, res) => {
  const trace = documents.getDocumentTrace(req.docType, req.params.id);
  if (!trace) return res.status(404).json({ error: 'Не найдено' });
  res.json(trace);
});

router.get('/:type/:id', parseType, requireDoc('read'), (req, res) => {
  const doc = documents.getDocument(req.docType, req.params.id);
  if (!doc) return res.status(404).json({ error: 'Не найдено' });
  res.json(doc);
});

router.post('/:type', parseType, requireDoc('create'), (req, res) => {
  try {
    const body = { ...req.body, createdByUserId: actorId(req) };
    res.status(201).json(documents.createDocument(req.docType, body));
  } catch (e) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

router.put('/:type/:id', parseType, requireDoc('create'), (req, res) => {
  try {
    res.json(documents.updateDocument(req.docType, req.params.id, req.body, actorId(req)));
  } catch (e) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

router.delete('/:type/:id', parseType, requireDoc('create'), (req, res) => {
  try {
    res.json(documents.deleteDocument(req.docType, req.params.id));
  } catch (e) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

router.post('/:type/:id/post', parseType, requireDoc('create'), (req, res) => {
  try {
    res.json(documents.postDocument(req.docType, req.params.id, actorId(req)));
  } catch (e) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

router.post('/:type/:id/repost', parseType, requireDoc('modify'), (req, res) => {
  try {
    const { userId: _ignored, ...patch } = req.body || {};
    res.json(documents.repostDocument(req.docType, req.params.id, actorId(req), patch));
  } catch (e) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

router.post('/:type/:id/cancel', parseType, requireDoc('create'), (req, res) => {
  try {
    res.json(documents.cancelDocument(req.docType, req.params.id, actorId(req)));
  } catch (e) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

router.post('/:type/:id/fulfill', parseType, requireDoc('create'), (req, res) => {
  try {
    res.json(
      documents.fulfillDocument(req.docType, req.params.id, actorId(req), {
        basisDocumentId: req.body?.basisDocumentId,
        basisDocumentNumber: req.body?.basisDocumentNumber,
      })
    );
  } catch (e) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

export default router;
