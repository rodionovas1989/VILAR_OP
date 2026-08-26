/**
 * Скан wiki/ и raw/ на типичные утечки секретов.
 * Exit 1 если найдено подозрительное — не панацея, но ловит явный copy-paste.
 *
 * Запуск: node scripts/wiki-secrets-lint.js
 */
const fs = require('fs');
const path = require('path');

const roots = ['wiki', 'raw'].map((r) => path.join(__dirname, '..', r));

const patterns = [
  { name: 'PEM private key', re: /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/ },
  { name: 'env assignment password/secret', re: /(?:password|passwd|secret|api[_-]?key|auth[_-]?secret|token)\s*[=:]\s*['"]?[^\s'"]{8,}/i },
  { name: 'VILAR_ADMIN_PASSWORD with value', re: /VILAR_ADMIN_PASSWORD\s*=\s*\S+/ },
  { name: 'AUTH_SECRET with value', re: /AUTH_SECRET\s*=\s*\S+/ },
  { name: 'basic auth in URL', re: /:\/\/[^/\s:]+:[^/\s@]+@/ },
  { name: 'probable SSH key line', re: /^(?:ssh-rsa|ssh-ed25519|ecdsa-sha2-nistp256)\s+[A-Za-z0-9+/=]{40,}/m },
];

/** Имена переменных без значений — ок; ложные срабатывания на «passwordHash» в прозе редки */
const allowLine = (line) => {
  if (/^\s*\|/.test(line) && /\|.*\|/.test(line) && !/=\s*\S{8,}/.test(line)) {
    // таблицы с именами колонок
  }
  if (/имя(ена)? переменн/i.test(line) || /EnvironmentFile/i.test(line)) return false;
  return false;
};

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (/\.(md|mdc|txt)$/i.test(ent.name)) out.push(p);
  }
  return out;
}

const findings = [];
for (const root of roots) {
  for (const file of walk(root)) {
    const text = fs.readFileSync(file, 'utf8');
    const lines = text.split(/\r?\n/);
    lines.forEach((line, i) => {
      if (allowLine(line)) return;
      // пропуск строк, которые только именуют переменную без присвоения
      if (/`(?:VILAR_ADMIN_PASSWORD|AUTH_SECRET)`/.test(line) && !/=\s*\S+/.test(line)) return;
      for (const { name, re } of patterns) {
        if (re.test(line)) {
          findings.push({ file, line: i + 1, name, preview: line.trim().slice(0, 120) });
        }
      }
    });
  }
}

if (findings.length === 0) {
  console.log('wiki-secrets-lint: OK (no matches)');
  process.exit(0);
}

console.error('wiki-secrets-lint: SUSPICIOUS matches:');
for (const f of findings) {
  console.error(`  ${f.file}:${f.line}  [${f.name}]  ${f.preview}`);
}
process.exit(1);
