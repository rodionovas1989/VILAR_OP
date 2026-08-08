import { Router } from 'express';
import { randomUUID } from 'crypto';
import * as store from '../store.js';

export function crudRouter(collection, { beforeCreate, beforeUpdate } = {}) {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json(store.readAll(collection));
  });

  router.get('/:id', (req, res) => {
    const row = store.getById(collection, req.params.id);
    if (!row) return res.status(404).json({ error: 'Не найдено' });
    res.json(row);
  });

  router.post('/', (req, res) => {
    let item = { id: randomUUID(), ...req.body };
    if (beforeCreate) item = beforeCreate(item) || item;
    res.status(201).json(store.create(collection, item));
  });

  router.put('/:id', (req, res) => {
    let patch = { ...req.body };
    delete patch.id;
    if (beforeUpdate) patch = beforeUpdate(patch) || patch;
    const row = store.update(collection, req.params.id, patch);
    if (!row) return res.status(404).json({ error: 'Не найдено' });
    res.json(row);
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
