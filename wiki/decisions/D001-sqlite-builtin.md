# D001 — SQLite через node:sqlite

**Решение:** хранилище `backend/data/vilar.sqlite`, обёртка `node:sqlite`, не `better-sqlite3` / node-gyp.

**Почему:** установка на Windows у заказчика без Visual Studio; WAL + транзакции достаточны для пилота.

**Следствие:** при росте конкурентных писателей — смотреть Postgres (roadmap).
