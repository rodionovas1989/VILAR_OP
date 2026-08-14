import crypto from 'crypto';

/**
 * Пароль Admin при первом создании пользователя / при смене слабого Admin/Admin.
 * Задаётся только через окружение — не храните боевой пароль в репозитории.
 */
export function resolveBootstrapAdminPassword() {
  const p = String(process.env.VILAR_ADMIN_PASSWORD || '').trim();
  if (p.length >= 8) return p;
  return null;
}

/** Одноразовый пароль, если VILAR_ADMIN_PASSWORD не задан (выводится в консоль). */
export function makeTemporaryAdminPassword() {
  return crypto.randomBytes(18).toString('base64url');
}
