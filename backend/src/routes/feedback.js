import { Router } from 'express';
import { actorId, requirePermission } from '../middleware/access.js';
import { getAccessLevel } from '../services/permissions.js';
import * as feedback from '../services/feedback.js';

const router = Router();
const OBJECT_ID = 'admin_feedback';

function access(req) {
  const level = getAccessLevel(req.permissions, OBJECT_ID);
  return {
    seeAll: level === 'modify',
    canModify: level === 'modify',
    canCreate: level === 'create' || level === 'modify',
  };
}

router.get('/', requirePermission(OBJECT_ID, 'read'), (req, res) => {
  const { seeAll } = access(req);
  res.json(feedback.listTickets(actorId(req), seeAll));
});

router.get('/:id', requirePermission(OBJECT_ID, 'read'), (req, res) => {
  const { seeAll } = access(req);
  const row = feedback.getTicket(req.params.id, actorId(req), seeAll);
  if (!row) return res.status(404).json({ error: 'Не найдено' });
  res.json(row);
});

router.post('/', requirePermission(OBJECT_ID, 'create'), (req, res) => {
  try {
    const created = feedback.createTicket(req.body || {}, req.user);
    res.status(201).json(created);
  } catch (e) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

router.put('/:id', requirePermission(OBJECT_ID, 'create'), (req, res) => {
  try {
    const { seeAll, canModify } = access(req);
    const row = feedback.updateTicket(req.params.id, req.body || {}, req.user, { seeAll, canModify });
    if (!row) return res.status(404).json({ error: 'Не найдено' });
    res.json(row);
  } catch (e) {
    const msg = e.message || String(e);
    res.status(msg.includes('прав') ? 403 : 400).json({ error: msg });
  }
});

router.delete('/:id', requirePermission(OBJECT_ID, 'create'), (req, res) => {
  try {
    const { seeAll, canModify } = access(req);
    const n = feedback.deleteTicket(req.params.id, req.user, { seeAll, canModify });
    if (!n) return res.status(404).json({ error: 'Не найдено' });
    res.json({ deleted: 1 });
  } catch (e) {
    const msg = e.message || String(e);
    res.status(msg.includes('прав') ? 403 : 400).json({ error: msg });
  }
});

export default router;
