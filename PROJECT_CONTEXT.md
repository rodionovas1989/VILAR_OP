# PROJECT_CONTEXT

## Ветка: feature/admin-data-reset-demo-backups (активна)

Администрирование: очистка БД, загрузка демо-данных, пул резервных копий sqlite.
Процесс релизов: локальная ветка → `main` → обновление ВМ (см. `.cursor/rules/releases-and-updates.mdc`).

### Сделано / в работе
- RBAC объект `admin_data_maintenance`
- API `/api/admin/backups`, `/data/clear`, `/data/demo`
- UI «Данные и резервные копии»
- Автослепок перед clear / demo / restore

### База
- SQLite, RES, completeOrder, JWT/RBAC, отчёты, обратная связь, руководство
- `VILAR_ADMIN_PASSWORD`, без подсказок Admin в UI (ветка fix/admin-login…)

### Локально (не в git)
- `local/YANDEX_CLOUD.md`, `local/CREDENTIALS.md`
