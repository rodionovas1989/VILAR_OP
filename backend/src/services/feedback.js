import { randomUUID } from 'crypto';
import * as store from '../store.js';

export const FEEDBACK_CATEGORIES = {
  like: 'понравилось',
  improve: 'улучшить',
  bug: 'ошибка',
  question: 'вопрос',
};

export const FEEDBACK_STATUSES = {
  new: 'новый',
  progress: 'в работе',
  done: 'закрыт',
  rejected: 'отклонён',
};

const CATEGORY_SET = new Set(Object.values(FEEDBACK_CATEGORIES));
const STATUS_SET = new Set(Object.values(FEEDBACK_STATUSES));

function nextNumber() {
  const dateStr = new Date().toISOString().slice(0, 10);
  const key = `FB:${dateStr}`;
  const sequences = store.readAll('document_sequences');
  const row = sequences.find((s) => s.key === key);
  const next = (row?.last ?? 0) + 1;
  if (row) store.update('document_sequences', row.id, { last: next });
  else store.create('document_sequences', { id: randomUUID(), key, last: next });
  return `FB-${dateStr}-${String(next).padStart(5, '0')}`;
}

function sortTickets(rows) {
  return [...rows].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

export function listTickets(userId, seeAll) {
  const rows = store.readAll('feedback');
  if (seeAll) return sortTickets(rows);
  return sortTickets(rows.filter((r) => r.createdByUserId === userId));
}

export function getTicket(id, userId, seeAll) {
  const row = store.getById('feedback', id);
  if (!row) return null;
  if (!seeAll && row.createdByUserId !== userId) return null;
  return row;
}

export function createTicket(payload, actor) {
  return store.runWrite(() => {
    const category = String(payload.category || '').trim();
    const title = String(payload.title || '').trim();
    const body = String(payload.body || '').trim();
    if (!CATEGORY_SET.has(category)) throw new Error('Укажите категорию обращения');
    if (!title) throw new Error('Укажите тему');
    if (!body) throw new Error('Опишите обращение');
    if (!actor?.id) throw new Error('Не авторизован');

    const now = new Date().toISOString();
    return store.create('feedback', {
      id: randomUUID(),
      number: nextNumber(),
      createdAt: now,
      updatedAt: now,
      createdByUserId: actor.id,
      createdByName: actor.name || actor.login || actor.id,
      category,
      title,
      body,
      pageId: payload.pageId || '',
      pageLabel: payload.pageLabel || '',
      status: FEEDBACK_STATUSES.new,
      adminComment: '',
      respondedAt: null,
      respondedByUserId: null,
      respondedByName: null,
    });
  });
}

export function updateTicket(id, payload, actor, { seeAll, canModify }) {
  return store.runWrite(() => {
    const current = store.getById('feedback', id);
    if (!current) return null;
    const isOwner = current.createdByUserId === actor.id;
    if (!seeAll && !isOwner) throw new Error('Недостаточно прав');

    const now = new Date().toISOString();
    const patch = { updatedAt: now };

    if (isOwner && current.status === FEEDBACK_STATUSES.new) {
      if (payload.category != null) {
        const category = String(payload.category).trim();
        if (!CATEGORY_SET.has(category)) throw new Error('Укажите категорию обращения');
        patch.category = category;
      }
      if (payload.title != null) {
        const title = String(payload.title).trim();
        if (!title) throw new Error('Укажите тему');
        patch.title = title;
      }
      if (payload.body != null) {
        const body = String(payload.body).trim();
        if (!body) throw new Error('Опишите обращение');
        patch.body = body;
      }
      if (payload.pageId != null) patch.pageId = String(payload.pageId || '');
      if (payload.pageLabel != null) patch.pageLabel = String(payload.pageLabel || '');
    } else if (!canModify && (payload.title != null || payload.body != null || payload.category != null)) {
      throw new Error('Изменить обращение можно только в статусе «новый»');
    }

    if (canModify) {
      if (payload.status != null) {
        const status = String(payload.status).trim();
        if (!STATUS_SET.has(status)) throw new Error('Неизвестный статус');
        patch.status = status;
      }
      if (payload.adminComment != null) {
        patch.adminComment = String(payload.adminComment);
        if (patch.adminComment.trim()) {
          patch.respondedAt = now;
          patch.respondedByUserId = actor.id;
          patch.respondedByName = actor.name || actor.login || actor.id;
        }
      }
    }

    return store.update('feedback', id, patch);
  });
}

export function deleteTicket(id, actor, { seeAll, canModify }) {
  return store.runWrite(() => {
    const current = store.getById('feedback', id);
    if (!current) return 0;
    const isOwner = current.createdByUserId === actor.id;
    if (canModify || (isOwner && current.status === FEEDBACK_STATUSES.new)) {
      return store.removeMany('feedback', [id]);
    }
    if (!seeAll && !isOwner) throw new Error('Недостаточно прав');
    throw new Error('Удалить можно только своё обращение в статусе «новый»');
  });
}
