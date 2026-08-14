# PROJECT_CONTEXT

## Ветка: fix/admin-login-no-hint-strong-password (активна)

Убрать подсказки логина/пароля Admin из UI; bootstrap-пароль только через `VILAR_ADMIN_PASSWORD` (не светить в сети).

### Сделано
- `LoginModal` — пустые поля, без hint Admin/Admin
- `store.migrateDefaultUsers` — пароль из env / одноразовый в лог; апгрейд слабого `Admin`
- `local/CREDENTIALS.md`, `local/YANDEX_CLOUD.md` — учётки и шаги YC (не в git)

### База (main)
- SQLite, RES, completeOrder, JWT/RBAC, отчёты, обратная связь, руководство

### Локально (не в git)
- Заметки по пилоту в Yandex Cloud: `local/YANDEX_CLOUD.md` (папка `local/` в `.gitignore`)
