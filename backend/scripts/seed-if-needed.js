import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const backendRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const sqlitePath = path.join(backendRoot, 'data', 'vilar.sqlite');

if (fs.existsSync(sqlitePath)) {
  console.log('Found existing vilar.sqlite — seed skipped.');
  process.exit(0);
}

const result = spawnSync(process.execPath, ['scripts/seed.js'], {
  cwd: backendRoot,
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
