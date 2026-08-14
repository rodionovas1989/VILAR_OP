# PROJECT_CONTEXT

## Ветка: fix/sqlite-builtin-no-gyp (активна)

Убрать `better-sqlite3` (node-gyp / Visual Studio) — SQLite через встроенный `node:sqlite`.

### Сделано
- `backend/src/sqlite.js` — WAL, busy_timeout, транзакции/savepoint
- Скрипты node с `--experimental-sqlite` (Node 22)
- `install.bat` больше не собирает native-модуль

### База (main)
- SQLite, RES, completeOrder, JWT/RBAC, отчёты, обратная связь, руководство
