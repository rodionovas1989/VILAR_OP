import * as auth from '../services/auth.js';
import { getAccessLevel, resolveUserPermissions } from '../services/permissions.js';
import { objectIdForCollection, writeLevelForCollection } from '../constants/collectionAccess.js';

const LEVEL_RANK = { none: 0, read: 1, create: 2, modify: 3 };

export function allowsLevel(have, need) {
  return (LEVEL_RANK[have] || 0) >= (LEVEL_RANK[need] || 0);
}

export function requireAuth(req, res, next) {
  const user = auth.userFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'Не авторизован' });
  }
  req.user = user;
  req.permissions = resolveUserPermissions(user);
  next();
}

/** Пропуск login/health без токена. Вешать на app.use('/api', ...). */
export function requireAuthUnlessPublic(req, res, next) {
  const open =
    (req.method === 'GET' && req.path === '/health') ||
    (req.method === 'POST' && req.path === '/auth/login') ||
    (req.method === 'POST' && req.path === '/auth/logout');
  if (open) return next();
  return requireAuth(req, res, next);
}

export function actorId(req) {
  return req.user?.id || null;
}

export function requirePermission(objectId, level = 'read') {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Не авторизован' });
    }
    const have = getAccessLevel(req.permissions, objectId);
    if (!allowsLevel(have, level)) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }
    next();
  };
}

/** Достаточно любого из перечисленных [objectId, level]. */
export function requireAnyPermission(pairs) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Не авторизован' });
    }
    const ok = pairs.some(([objectId, level]) =>
      allowsLevel(getAccessLevel(req.permissions, objectId), level)
    );
    if (!ok) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }
    next();
  };
}

export function requireCollectionAccess(collection, kind) {
  return (req, res, next) => {
    const objectId = objectIdForCollection(collection);
    if (!objectId) {
      return requirePermission('admin_users', 'modify')(req, res, next);
    }
    const level = kind === 'read' ? 'read' : writeLevelForCollection(collection);
    return requirePermission(objectId, level)(req, res, next);
  };
}
