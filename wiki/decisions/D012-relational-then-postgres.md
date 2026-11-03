# D012 — реляционная схема, затем PostgreSQL

**Решение:** уйти от JSON-таблицы `records` как источника истины. Два этапа:

1. **STOR1** — нормальные таблицы, UNIQUE/FK и SQL в **том же SQLite** (`node:sqlite`).
2. **I1** — перенос той же логической схемы на **PostgreSQL** (не MySQL).

**Почему:** сначала чиним модель хранения без смены СУБД и деплоя; переезд на серверную БД становится сменой драйвера + cutover данных, а не одновременным рефакторингом домена.

**Не отменяет** [D001](D001-sqlite-builtin.md) на этапе 1: SQLite остаётся движком файла до I1.

**Канон плана:** [docs/plans/relational-storage-postgres.md](../../docs/plans/relational-storage-postgres.md)  
**Разбор:** [analyses/relational-storage-migration.md](../analyses/relational-storage-migration.md)
