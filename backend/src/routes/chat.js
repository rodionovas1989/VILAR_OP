import { Router } from 'express';
import * as chat from '../services/chat.js';
import { requireAuth, actorId } from '../middleware/access.js';
import { publicUser } from '../services/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/messages', (req, res) => {
  try {
    const limit = Number(req.query.limit) || 100;
    res.json(chat.listChatMessages(limit));
  } catch (e) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

router.post('/messages', (req, res) => {
  try {
    const user = req.user;
    const pub = publicUser(user);
    res.status(201).json(
      chat.postChatMessage({
        userId: actorId(req),
        userName: pub.name || pub.login,
        text: req.body?.text,
      })
    );
  } catch (e) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

export default router;
