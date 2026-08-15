import { randomUUID } from 'crypto';
import * as store from '../store.js';

const COLLECTION = 'chat_messages';
const MAX_MESSAGES = 200;
const MAX_TEXT = 1000;

export function listChatMessages(limit = 100) {
  const n = Math.min(MAX_MESSAGES, Math.max(1, Number(limit) || 100));
  return store
    .readAll(COLLECTION)
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
    .slice(-n);
}

export function postChatMessage({ userId, userName, text }) {
  const body = String(text || '').trim();
  if (!body) throw new Error('Пустое сообщение');
  if (body.length > MAX_TEXT) throw new Error(`Сообщение длиннее ${MAX_TEXT} символов`);
  if (!userId) throw new Error('Не авторизован');

  const msg = {
    id: randomUUID(),
    userId,
    userName: userName || 'Пользователь',
    text: body,
    createdAt: new Date().toISOString(),
  };

  return store.runWrite(() => {
    store.create(COLLECTION, msg);
    const all = store
      .readAll(COLLECTION)
      .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
    if (all.length > MAX_MESSAGES) {
      const drop = all.slice(0, all.length - MAX_MESSAGES);
      store.removeMany(
        COLLECTION,
        drop.map((row) => row.id)
      );
    }
    return msg;
  });
}
