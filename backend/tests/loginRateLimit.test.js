import assert from 'node:assert/strict';
import {
  loginRateLimit,
  _resetLoginRateLimitForTests,
} from '../src/middleware/loginRateLimit.js';

function mockReq(ip, login) {
  return {
    ip,
    socket: { remoteAddress: ip },
    headers: {},
    body: { login, password: 'x' },
  };
}

function run(req) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      headers: {},
      setHeader(k, v) {
        this.headers[k] = v;
      },
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.body = body;
        resolve({ status: this.statusCode, body, headers: this.headers });
        return this;
      },
    };
    loginRateLimit(req, res, () => resolve({ status: 200, passed: true }));
  });
}

process.env.LOGIN_RATE_MAX = '3';
process.env.LOGIN_RATE_WINDOW_MS = '60000';
_resetLoginRateLimitForTests();

const ip = '203.0.113.10';
assert.equal((await run(mockReq(ip, 'Admin'))).passed, true);
assert.equal((await run(mockReq(ip, 'Admin'))).passed, true);
assert.equal((await run(mockReq(ip, 'Admin'))).passed, true);
const blocked = await run(mockReq(ip, 'Admin'));
assert.equal(blocked.status, 429);
assert.match(blocked.body.error, /Слишком много попыток/);
assert.ok(Number(blocked.headers['Retry-After']) >= 1);

// Other IP still allowed (until login key also trips)
_resetLoginRateLimitForTests();
assert.equal((await run(mockReq('203.0.113.20', 'other'))).passed, true);

console.log('loginRateLimit ok');
