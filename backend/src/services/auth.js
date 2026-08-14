import * as store from '../store.js';
import { verifyPassword } from '../utils/password.js';
import { getRoleById, resolveRoleId, resolveUserPermissions } from './permissions.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { DATA_DIR } from '../store.js';

export { hashPassword, verifyPassword } from '../utils/password.js';

const SECRET_FILE = path.join(DATA_DIR, 'auth_secret');
const DEV_FALLBACK = 'vilar-op-dev-secret-change-in-prod';

function loadAuthSecret() {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(SECRET_FILE)) {
      fs.writeFileSync(SECRET_FILE, crypto.randomBytes(32).toString('hex'), { encoding: 'utf8' });
    }
    const fromFile = fs.readFileSync(SECRET_FILE, 'utf8').trim();
    if (fromFile) return fromFile;
  } catch (e) {
    console.warn('Could not persist AUTH_SECRET to data/auth_secret:', e.message);
  }
  return DEV_FALLBACK;
}

const SECRET = loadAuthSecret();
const SESSION_MS = 8 * 60 * 60 * 1000;
const REMEMBER_MS = 30 * 24 * 60 * 60 * 1000;

function signToken(userId, ttlMs) {
  const exp = Date.now() + ttlMs;
  const payload = JSON.stringify({ userId, exp });
  const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
  return Buffer.from(JSON.stringify({ payload, sig })).toString('base64');
}

export function verifyToken(token) {
  if (!token) return null;
  try {
    const parsed = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
    const payloadStr =
      typeof parsed.payload === 'string' ? parsed.payload : JSON.stringify(parsed.payload);
    const data =
      typeof parsed.payload === 'string' ? JSON.parse(parsed.payload) : parsed.payload;
    const sig = crypto.createHmac('sha256', SECRET).update(payloadStr).digest('hex');
    if (sig !== parsed.sig) return null;
    if (Date.now() > data.exp) return null;
    const user = store.getById('users', data.userId);
    if (!user || user.active === false) return null;
    return user;
  } catch {
    return null;
  }
}

export function login(loginName, password, rememberMe = false) {
  const login = String(loginName || '').trim();
  if (!login || !password) throw new Error('Укажите логин и пароль');
  const user = store.readAll('users').find((u) => u.login === login && u.active !== false);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw new Error('Неверный логин или пароль');
  }
  const ttl = rememberMe ? REMEMBER_MS : SESSION_MS;
  return {
    token: signToken(user.id, ttl),
    expiresInMs: ttl,
    rememberMe: Boolean(rememberMe),
    user: publicUser(user),
  };
}

export function publicUser(user) {
  const roleId = resolveRoleId(user);
  const role = getRoleById(roleId);
  const permissions = resolveUserPermissions(user);
  return {
    id: user.id,
    name: user.name,
    login: user.login,
    role: user.role || role?.code || null,
    roleId,
    roleName: role?.name || null,
    permissions,
    active: user.active !== false,
  };
}

export function userFromRequest(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  return verifyToken(token);
}

export function warnIfDefaultAdminPassword() {
  try {
    const admin = store.readAll('users').find((u) => u.login === 'Admin');
    if (admin && verifyPassword('Admin', admin.passwordHash)) {
      console.warn(
        'WARNING: user Admin still has the weak password "Admin". Set VILAR_ADMIN_PASSWORD and restart, or change it in Users.',
      );
    }
  } catch {
    /* база ещё не готова */
  }
}
