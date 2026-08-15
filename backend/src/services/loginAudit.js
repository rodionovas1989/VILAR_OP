import fs from 'fs';
import path from 'path';
import { DATA_DIR } from '../store.js';

const AUDIT_FILE = path.join(DATA_DIR, 'login_audit.jsonl');
const MAX_LINES_DEFAULT = 2000;

function ensureDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * Append one login attempt. Survives CLEAR/DEMO (file next to sqlite, not in records).
 * @param {{ ok: boolean, login?: string, userId?: string|null, ip?: string, reason?: string }} row
 */
export function recordLoginAttempt(row) {
  ensureDir();
  const line = JSON.stringify({
    at: new Date().toISOString(),
    ok: Boolean(row.ok),
    login: String(row.login || '').slice(0, 80),
    userId: row.userId || null,
    ip: String(row.ip || '').slice(0, 80),
    reason: row.reason ? String(row.reason).slice(0, 200) : null,
  });
  fs.appendFileSync(AUDIT_FILE, `${line}\n`, 'utf8');
}

/** Newest first. */
export function listLoginAttempts({ limit = 200 } = {}) {
  ensureDir();
  if (!fs.existsSync(AUDIT_FILE)) return [];
  const raw = fs.readFileSync(AUDIT_FILE, 'utf8');
  if (!raw.trim()) return [];
  const lines = raw.trim().split('\n');
  const maxRead = Math.min(lines.length, MAX_LINES_DEFAULT);
  const slice = lines.slice(-maxRead);
  const items = [];
  for (let i = slice.length - 1; i >= 0; i--) {
    try {
      items.push(JSON.parse(slice[i]));
    } catch {
      /* skip bad line */
    }
    if (items.length >= limit) break;
  }
  return items;
}
