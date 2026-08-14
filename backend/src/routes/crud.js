import { Router } from 'express';
import { randomUUID } from 'crypto';
import * as store from '../store.js';

export function crudRouter(collection, { beforeCreate, beforeUpdate, sanitize } = {}) {
  const router = Router();

  router.get('/', (_req, res) => {
    const rows = store.readAll(collection);
    res.json(sanitize ? rows.map((r) => sanitize(r)) : rows);
  });

  router.get('/:id', (req, res) => {
    const row = store.getById(collection, req.params.id);
    if (!row) return res.status(404).json({ error: 'Не найдено' });
    res.json(sanitize ? sanitize(row) : row);
  });

  router.post('/', (req, res) => {
    try {
      let item = { id: randomUUID(), ...req.body };
      if (beforeCreate) item = beforeCreate(item) || item;
      const created = store.create(collection, item);
      res.status(201).json(sanitize ? sanitize(created) : created);
    } catch (e) {
      res.status(400).json({ error: e.message || String(e) });
    }
  });

  router.put('/:id', (req, res) => {
    try {
      let patch = { ...req.body };
      delete patch.id;
      const current = store.getById(collection, req.params.id);
      if (!current) return res.status(404).json({ error: 'Не найдено' });
      if (beforeUpdate) patch = beforeUpdate({ ...current, ...patch }, current) || patch;
      const row = store.update(collection, req.params.id, patch);
      if (!row) return res.status(404).json({ error: 'Не найдено' });
      res.json(sanitize ? sanitize(row) : row);
    } catch (e) {
      res.status(400).json({ error: e.message || String(e) });
    }
  });

  router.post('/bulk-delete', (req, res) => {
    const ids = req.body?.ids || [];
    const n = store.removeMany(collection, ids);
    res.json({ deleted: n });
  });

  router.delete('/:id', (req, res) => {
    const n = store.removeMany(collection, [req.params.id]);
    if (!n) return res.status(404).json({ error: 'Не найдено' });
    res.json({ deleted: 1 });
  });

  return router;
}
