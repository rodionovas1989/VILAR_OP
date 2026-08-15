import fs from 'fs';
import path from 'path';
import { DATA_DIR } from '../store.js';
import { LOGIN_AUDIT_RETENTION_DAYS } from '../constants/legal.js';

const AUDIT_FILE = path.join(DATA_DIR, 'login_audit.jsonl');
const MAX_LINES_DEFAULT = 2000;

function ensureDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function parseAt(line) {
  try {
    const row = JSON.parse(line);
    const t = Date.parse(row.at || '');
    return Number.isFinite(t) ? t : null;
  } catch {
    return null;
  }
}

/** Drop lines older than retention; rewrite file if trimmed. */
export function compactLoginAudit(retentionDays = LOGIN_AUDIT_RETENTION_DAYS) {
  ensureDir();
  if (!fs.existsSync(AUDIT_FILE)) return { kept: 0, dropped: 0 };
  const raw = fs.readFileSync(AUDIT_FILE, 'utf8');
  if (!raw.trim()) return { kept: 0, dropped: 0 };
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const lines = raw.trim().split('\n');
  const kept = [];
  let dropped = 0;
  for (const line of lines) {
    if (!line.trim()) continue;
    const t = parseAt(line);
    if (t != null && t < cutoff) {
      dropped += 1;
      continue;
    }
    kept.push(line);
  }
  if (dropped > 0) {
    fs.writeFileSync(AUDIT_FILE, kept.length ? `${kept.join('\n')}\n` : '', 'utf8');
  }
  return { kept: kept.length, dropped };
}

/**
 * Append one login attempt. Survives CLEAR/DEMO (file next to sqlite, not in records).
 * @param {{ ok: boolean, login?: string, userId?: string|null, ip?: string, reason?: string }} row
 */
export function recordLoginAttempt(row) {
  ensureDir();
  compactLoginAudit();
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
  compactLoginAudit();
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
