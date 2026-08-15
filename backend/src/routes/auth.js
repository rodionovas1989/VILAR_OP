import { Router } from 'express';
import * as auth from '../services/auth.js';
import * as favorites from '../services/favorites.js';
import * as loginAudit from '../services/loginAudit.js';
import { loginRateLimit, clientIp } from '../middleware/loginRateLimit.js';

const router = Router();

function requireUser(req, res) {
  const user = auth.userFromRequest(req);
  if (!user) {
    res.status(401).json({ error: 'Не авторизован' });
    return null;
  }
  return user;
}

router.post('/login', loginRateLimit, (req, res) => {
  const ip = clientIp(req);
  const loginName = String(req.body?.login || '').trim();
  try {
    const { login, password, rememberMe } = req.body || {};
    const result = auth.login(login, password, rememberMe);
    loginAudit.recordLoginAttempt({
      ok: true,
      login: loginName,
      userId: result.user?.id,
      ip,
    });
    res.json(result);
  } catch (e) {
    loginAudit.recordLoginAttempt({
      ok: false,
      login: loginName,
      ip,
      reason: e.message || String(e),
    });
    res.status(401).json({ error: e.message || String(e) });
  }
});

router.get('/me', (req, res) => {
  const user = auth.userFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Не авторизован' });
  res.json(auth.publicUser(user));
});

router.post('/logout', (_req, res) => {
  // Stateless JWT: выход на клиенте (удаление токена). Эндпоинт — для будущего audit log.
  res.json({ ok: true });
});

router.get('/favorites', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  res.json({ items: favorites.getUserFavorites(user.id) });
});

router.put('/favorites', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  try {
    res.json({ items: favorites.saveUserFavorites(user.id, req.body?.items || []) });
  } catch (e) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

router.post('/favorites/toggle', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  try {
    res.json({ items: favorites.toggleUserFavorite(user.id, req.body?.pageId) });
  } catch (e) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

export default router;
