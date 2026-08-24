import fs from 'fs';
import path from 'path';
import { DATA_DIR } from '../store.js';
import { LOGIN_AUDIT_RETENTION_DAYS } from '../constants/legal.js';

const LOG_FILE = path.join(DATA_DIR, 'ops_debug.jsonl');
const MAX_LINES_DEFAULT = 5000;
const OPS_DEBUG_RETENTION_DAYS = LOGIN_AUDIT_RETENTION_DAYS;

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

export function compactOpsDebugLog(retentionDays = OPS_DEBUG_RETENTION_DAYS) {
  ensureDir();
  if (!fs.existsSync(LOG_FILE)) return { kept: 0, dropped: 0 };
  const raw = fs.readFileSync(LOG_FILE, 'utf8');
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
    fs.writeFileSync(LOG_FILE, kept.length ? `${kept.join('\n')}\n` : '', 'utf8');
  }
  return { kept: kept.length, dropped };
}

/**
 * @param {{
 *   requestId?: string,
 *   level?: string,
 *   method?: string,
 *   path?: string,
 *   statusCode?: number,
 *   durationMs?: number,
 *   userId?: string|null,
 *   error?: string|null,
 *   refs?: Record<string, string>,
 * }} row
 */
export function recordOpsEvent(row) {
  ensureDir();
  compactOpsDebugLog();
  const level = row.level || 'info';
  const line = JSON.stringify({
    at: new Date().toISOString(),
    requestId: row.requestId ? String(row.requestId).slice(0, 64) : null,
    level,
    method: String(row.method || '').slice(0, 12),
    path: String(row.path || '').slice(0, 240),
    statusCode: Number(row.statusCode) || 0,
    durationMs: Number(row.durationMs) || 0,
    userId: row.userId || null,
    error: row.error ? String(row.error).slice(0, 400) : null,
    refs: row.refs && typeof row.refs === 'object' ? row.refs : null,
  });
  fs.appendFileSync(LOG_FILE, `${line}\n`, 'utf8');
}

/** Newest first. */
export function listOpsEvents({ limit = 300 } = {}) {
  ensureDir();
  compactOpsDebugLog();
  if (!fs.existsSync(LOG_FILE)) return [];
  const raw = fs.readFileSync(LOG_FILE, 'utf8');
  if (!raw.trim()) return [];
  const lines = raw.trim().split('\n');
  const maxRead = Math.min(lines.length, MAX_LINES_DEFAULT);
  const slice = lines.slice(-maxRead);
  const items = [];
  for (let i = slice.length - 1; i >= 0; i--) {
    try {
      items.push(JSON.parse(slice[i]));
    } catch {
      /* skip */
    }
  }
  return items.slice(0, Math.max(1, Math.min(Number(limit) || 300, 2000)));
}
