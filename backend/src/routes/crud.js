import { Router } from 'express';
import { randomUUID } from 'crypto';
import * as store from '../store.js';
import { requireCollectionAccess } from '../middleware/access.js';
import { assertCanDelete, isProtectedDictionary } from '../services/referentialIntegrity.js';

export function crudRouter(collection, { beforeCreate, beforeUpdate, sanitize, readOnly = false } = {}) {
  const router = Router();

  const denyWrite = (_req, res) => {
    res.status(405).json({
      error: 'Изменение только через проведение документов или специализированный API',
    });
  };

  router.get('/', requireCollectionAccess(collection, 'read'), (_req, res) => {
    const rows = store.readAll(collection);
    res.json(sanitize ? rows.map((r) => sanitize(r)) : rows);
  });

  router.get('/:id', requireCollectionAccess(collection, 'read'), (req, res) => {
    const row = store.getById(collection, req.params.id);
    if (!row) return res.status(404).json({ error: 'Не найдено' });
    res.json(sanitize ? sanitize(row) : row);
  });

  router.post('/', readOnly ? denyWrite : requireCollectionAccess(collection, 'write'), (req, res) => {
    try {
      const created = store.runWrite(() => {
        let item = { id: randomUUID(), ...req.body };
        if (beforeCreate) item = beforeCreate(item, req) || item;
        return store.create(collection, item);
      });
      res.status(201).json(sanitize ? sanitize(created) : created);
    } catch (e) {
      res.status(400).json({ error: e.message || String(e) });
    }
  });

  router.put('/:id', readOnly ? denyWrite : requireCollectionAccess(collection, 'write'), (req, res) => {
    try {
      const row = store.runWrite(() => {
        let patch = { ...req.body };
        delete patch.id;
        const current = store.getById(collection, req.params.id);
        if (!current) return null;
        if (beforeUpdate) patch = beforeUpdate({ ...current, ...patch }, current, req) || patch;
        return store.update(collection, req.params.id, patch);
      });
      if (!row) return res.status(404).json({ error: 'Не найдено' });
      res.json(sanitize ? sanitize(row) : row);
    } catch (e) {
      res.status(400).json({ error: e.message || String(e) });
    }
  });

  router.post('/bulk-delete', readOnly ? denyWrite : requireCollectionAccess(collection, 'write'), (req, res) => {
    try {
      const ids = req.body?.ids || [];
      const n = store.runWrite(() => {
        if (isProtectedDictionary(collection)) assertCanDelete(collection, ids);
        return store.removeMany(collection, ids);
      });
      res.json({ deleted: n });
    } catch (e) {
      res.status(400).json({ error: e.message || String(e) });
    }
  });

  router.delete('/:id', readOnly ? denyWrite : requireCollectionAccess(collection, 'write'), (req, res) => {
    try {
      const n = store.runWrite(() => {
        if (isProtectedDictionary(collection)) assertCanDelete(collection, [req.params.id]);
        return store.removeMany(collection, [req.params.id]);
      });
      if (!n) return res.status(404).json({ error: 'Не найдено' });
      res.json({ deleted: 1 });
    } catch (e) {
      res.status(400).json({ error: e.message || String(e) });
    }
  });

  return router;
}
