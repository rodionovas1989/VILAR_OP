import { ensureCollections, readAll, writeAll, closeDb } from '../src/store.js';
import { hashPassword, verifyPassword } from '../src/utils/password.js';
import { spawnSync } from 'child_process';

const mode = process.argv[2] || 'check';
const pwd = process.env.VILAR_ADMIN_PASSWORD || 'Cgjldsgjldthnjv132@';

ensureCollections();
const users = readAll('users');
const admin = users.find((u) => u.login === 'Admin');
console.log('admin', admin && { id: admin.id, roleId: admin.roleId, active: admin.active, role: admin.role });

if (mode === 'reset') {
  if (!admin) {
    console.error('Admin not found');
    process.exit(1);
  }
  admin.passwordHash = hashPassword(pwd);
  writeAll('users', users);
  console.log('password reset to VILAR_ADMIN_PASSWORD / default strong');
}

if (admin) {
  console.log('pass Admin?', verifyPassword('Admin', admin.passwordHash));
  console.log('pass strong?', verifyPassword(pwd, admin.passwordHash));
}

const ar = readAll('roles').find((r) => r.id === 'role-administrator');
console.log('doc_receipt', JSON.stringify(ar?.permissions?.doc_receipt));
console.log('permCount', Object.keys(ar?.permissions || {}).length);

const gitRoot = process.env.GIT_ROOT || new URL('../..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const br = spawnSync('git', ['-C', gitRoot, 'rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' });
console.log('branch', (br.stdout || '').trim() || (br.stderr || '').trim());
const log = spawnSync('git', ['-C', gitRoot, 'log', '-1', '--oneline'], { encoding: 'utf8' });
console.log('head', (log.stdout || '').trim());
closeDb();
