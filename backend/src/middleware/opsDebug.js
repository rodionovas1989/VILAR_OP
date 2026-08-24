import { randomUUID } from 'crypto';
import { recordOpsEvent } from '../services/opsDebugLog.js';
import { actorId } from './access.js';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function shouldSkip(req) {
  const p = req.path || '';
  if (req.method === 'GET' && (p === '/health' || p === '/api/health')) return true;
  return false;
}

function extractRefs(req) {
  const refs = {};
  const params = req.params || {};
  for (const key of ['id', 'type', 'collection', 'orderId']) {
    if (params[key] != null && params[key] !== '') {
      refs[key] = String(params[key]).slice(0, 80);
    }
  }
  // path segments like /planning/complete/:id
  const path = String(req.originalUrl || req.url || '').split('?')[0];
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  for (const key of [
    'productionOrderId',
    'documentId',
    'seriesId',
    'materialId',
    'lotId',
    'specificationId',
  ]) {
    if (body[key] != null && body[key] !== '') {
      refs[key] = String(body[key]).slice(0, 80);
    }
  }
  if (path.includes('/complete/') || path.includes('/production-fact/')) {
    const m = path.match(/\/(complete|production-fact)\/([^/]+)/);
    if (m) refs.orderId = m[2].slice(0, 80);
  }
  return Object.keys(refs).length ? refs : null;
}

function levelFor(statusCode) {
  if (statusCode >= 500) return 'error';
  if (statusCode >= 400) return 'warn';
  return 'info';
}

/** Логирует мутации (2xx/4xx/5xx) и любые ошибки GET; без тел login/паролей. */
export function opsDebugMiddleware(req, res, next) {
  if (shouldSkip(req)) return next();

  const requestId = randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  const started = Date.now();

  res.on('finish', () => {
    try {
      const statusCode = res.statusCode || 0;
      const mutating = MUTATING.has(req.method);
      const failed = statusCode >= 400;
      if (!mutating && !failed) return;

      // login: только метаданные, без body
      const path = String(req.originalUrl || req.url || '').split('?')[0];
      const isLogin = path.endsWith('/auth/login');

      let errorMsg = null;
      if (failed && res.locals?.opsError) {
        errorMsg = res.locals.opsError;
      } else if (failed) {
        errorMsg = `HTTP ${statusCode}`;
      }

      recordOpsEvent({
        requestId,
        level: levelFor(statusCode),
        method: req.method,
        path: path.slice(0, 240),
        statusCode,
        durationMs: Date.now() - started,
        userId: isLogin ? null : actorId(req),
        error: errorMsg,
        refs: isLogin ? { loginAttempt: '1' } : extractRefs(req),
      });
    } catch {
      /* never break response */
    }
  });

  next();
}

/** Express error handler: пишет 5xx в ops-лог и отдаёт JSON. */
export function opsDebugErrorHandler(err, req, res, _next) {
  const status = Number(err.status || err.statusCode) || 500;
  const message = err.message || String(err);
  res.locals.opsError = message;
  if (!res.headersSent) {
    res.status(status).json({ error: message, requestId: req.requestId || null });
  }
}
