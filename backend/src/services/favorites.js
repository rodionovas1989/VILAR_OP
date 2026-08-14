import * as store from '../store.js';
import { canUserAccessPage, isFavoritePageId } from '../constants/navPages.js';

const COL = 'user_favorites';

function rowForUser(userId) {
  return store.readAll(COL).find((r) => r.userId === userId) || null;
}

function normalizeItems(items) {
  if (!Array.isArray(items)) throw new Error('items must be array');
  return items
    .map((it) => ({
      pageId: String(it.pageId || '').trim(),
      addedAt: it.addedAt || new Date().toISOString(),
    }))
    .filter((it) => it.pageId && isFavoritePageId(it.pageId));
}

function filterForUser(user, items) {
  return items.filter((it) => canUserAccessPage(user, it.pageId));
}

function getUserRecord(userId) {
  return store.getById('users', userId);
}

export function getUserFavorites(userId) {
  const user = getUserRecord(userId);
  const raw = rowForUser(userId)?.items ?? [];
  if (!user) return [];
  const filtered = filterForUser(user, raw);
  if (filtered.length !== raw.length) {
    saveUserFavorites(userId, filtered, user);
  }
  return filtered;
}

export function saveUserFavorites(userId, items, user = getUserRecord(userId)) {
  const normalized = normalizeItems(items);
  const allowed = user ? filterForUser(user, normalized) : [];
  const existing = rowForUser(userId);
  const payload = {
    userId,
    items: allowed,
    updatedAt: new Date().toISOString(),
  };
  if (existing) {
    return store.update(COL, existing.id, payload).items;
  }
  return store.create(COL, { id: userId, ...payload }).items;
}

export function toggleUserFavorite(userId, pageId) {
  const user = getUserRecord(userId);
  if (!user) throw new Error('Пользователь не найден');
  const pid = String(pageId || '').trim();
  if (!pid) throw new Error('Укажите pageId');
  if (!isFavoritePageId(pid)) throw new Error('Неизвестный раздел');

  const items = [...getUserFavorites(userId)];
  const idx = items.findIndex((i) => i.pageId === pid);
  if (idx >= 0) {
    items.splice(idx, 1);
  } else {
    if (!canUserAccessPage(user, pid)) {
      throw new Error('Нет прав на просмотр этого раздела');
    }
    items.push({ pageId: pid, addedAt: new Date().toISOString() });
  }
  return saveUserFavorites(userId, items, user);
}
