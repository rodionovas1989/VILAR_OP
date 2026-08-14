import { DatabaseSync } from 'node:sqlite';

/**
 * Обёртка над встроенным node:sqlite (синхронный API, без native-сборки).
 * Совместима с вызовами better-sqlite3: prepare/exec/transaction/close.
 */
export function openDatabase(filePath) {
  const db = new DatabaseSync(filePath, { timeout: 8000 });
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA busy_timeout = 8000');
  attachTransactions(db);
  return db;
}

function attachTransactions(db) {
  let depth = 0;
  db.transaction = (fn) => {
    const exec = (beginSql, args) => {
      const nested = depth > 0;
      const sp = nested ? `sp_${depth}` : null;
      if (nested) db.exec(`SAVEPOINT ${sp}`);
      else db.exec(beginSql);
      depth += 1;
      try {
        const result = fn(...args);
        depth -= 1;
        if (nested) db.exec(`RELEASE ${sp}`);
        else db.exec('COMMIT');
        return result;
      } catch (e) {
        depth -= 1;
        try {
          if (nested) db.exec(`ROLLBACK TO ${sp}`);
          else db.exec('ROLLBACK');
        } catch {
          /* ignore rollback errors */
        }
        throw e;
      }
    };
    const run = (...args) => exec('BEGIN', args);
    run.immediate = (...args) => exec('BEGIN IMMEDIATE', args);
    return run;
  };
}
