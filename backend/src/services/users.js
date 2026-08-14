import { hashPassword } from '../utils/password.js';

export function sanitizeUser(user) {
  if (!user) return user;
  const { passwordHash, password, ...rest } = user;
  return rest;
}

export function prepareUserCreate(item) {
  const password = String(item.password || '').trim();
  delete item.password;
  delete item.passwordHash;

  if (!item.name?.trim()) throw new Error('Укажите имя пользователя');
  if (!item.login?.trim()) throw new Error('Укажите логин');
  if (!password) throw new Error('Укажите пароль');
  if (password.length < 4) throw new Error('Пароль не короче 4 символов');
  if (!item.roleId) throw new Error('Выберите роль');

  const login = item.login.trim();
  const dup = item._allUsers?.find((u) => u.login === login);
  if (dup) throw new Error('Пользователь с таким логином уже есть');

  item.name = item.name.trim();
  item.login = login;
  item.passwordHash = hashPassword(password);
  item.active = item.active !== false && item.active !== 'false';
  delete item._allUsers;
  return item;
}

export function prepareUserUpdate(merged, current) {
  const password = String(merged.password || '').trim();
  delete merged.password;

  if (merged.passwordHash !== undefined) delete merged.passwordHash;

  if (merged.name !== undefined) merged.name = String(merged.name).trim();
  if (merged.login !== undefined) {
    const login = String(merged.login).trim();
    if (!login) throw new Error('Укажите логин');
    merged.login = login;
  }
  if (merged.active !== undefined) {
    merged.active = merged.active !== false && merged.active !== 'false';
  }

  if (password) {
    if (password.length < 4) throw new Error('Пароль не короче 4 символов');
    merged.passwordHash = hashPassword(password);
  }

  return merged;
}
