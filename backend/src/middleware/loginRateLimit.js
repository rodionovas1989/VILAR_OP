/**
 * In-memory rate limit for POST /auth/login (single Node process).
 * Keys: client IP and normalized login (slows password spraying).
 *
 * Env:
 *   LOGIN_RATE_MAX=10          max attempts per window (default 10)
 *   LOGIN_RATE_WINDOW_MS=900000  window length, default 15 min
 */

const DEFAULT_MAX = 10;
const DEFAULT_WINDOW_MS = 15 * 60 * 1000;

/** @type {Map<string, { count: number, resetAt: number }>} */
const buckets = new Map();

function maxAttempts() {
  const n = Number(process.env.LOGIN_RATE_MAX);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_MAX;
}

function windowMs() {
  const n = Number(process.env.LOGIN_RATE_WINDOW_MS);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_WINDOW_MS;
}

export function clientIp(req) {
  // Do not trust X-Forwarded-For on a bare public Node listen (spoofable).
  // Enable TRUST_PROXY=1 only behind nginx/Caddy that strips/sets the header.
  const trust =
    process.env.TRUST_PROXY === '1' ||
    process.env.TRUST_PROXY === 'true' ||
    process.env.TRUST_PROXY === 'yes';
  if (trust) {
    const xf = req.headers['x-forwarded-for'];
    if (typeof xf === 'string' && xf.trim()) {
      return xf.split(',')[0].trim();
    }
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function touch(key, now, window) {
  let b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    b = { count: 0, resetAt: now + window };
    buckets.set(key, b);
  }
  b.count += 1;
  return b;
}

/** Drop expired buckets occasionally to avoid unbounded growth. */
function sweep(now) {
  if (buckets.size < 500) return;
  for (const [k, b] of buckets) {
    if (now >= b.resetAt) buckets.delete(k);
  }
}

/**
 * Express middleware — place before login handler.
 * On limit: 429 + Retry-After (seconds).
 */
export function loginRateLimit(req, res, next) {
  const now = Date.now();
  const window = windowMs();
  const max = maxAttempts();
  sweep(now);

  const ip = clientIp(req);
  const login = String(req.body?.login || '')
    .trim()
    .toLowerCase();
  const keys = [`ip:${ip}`];
  if (login) keys.push(`login:${login}`);

  let blocked = null;
  for (const key of keys) {
    const b = touch(key, now, window);
    if (b.count > max) {
      blocked = b;
      break;
    }
  }

  if (blocked) {
    const retrySec = Math.max(1, Math.ceil((blocked.resetAt - now) / 1000));
    res.setHeader('Retry-After', String(retrySec));
    return res.status(429).json({
      error: `Слишком много попыток входа. Повторите через ${retrySec} с.`,
    });
  }

  next();
}

/** Test helper */
export function _resetLoginRateLimitForTests() {
  buckets.clear();
}
