# D001 — SQLite через node:sqlite

**Решение:** хранилище `backend/data/vilar.sqlite`, обёртка `node:sqlite`, не `better-sqlite3` / node-gyp.

**Почему:** установка на Windows у заказчика без Visual Studio; WAL + транзакции достаточны для пилота.

**Следствие:** при росте конкурентных писателей и для отчётов/интеграций — PostgreSQL (**I1**), после реляционной схемы в том же SQLite (**STOR1**). См. [D012](D012-relational-then-postgres.md); JSON-`records` как истина домена снимается планом STOR1, не отменой node:sqlite на этапе 1.
