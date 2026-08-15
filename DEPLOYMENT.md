# DEPLOYMENT

## Требования
- Node.js **22+** (портативный `.tools/node` или системный LTS 22)
- npm
- Visual Studio / C++ **не нужны** (SQLite — встроенный `node:sqlite`)

Локальные заметки по облаку/IP/SSH (не в git): папка `local/` (см. `.gitignore`).

## Для пользователя (Windows, без командной строки)

Только ASCII-имена (кириллические `.bat` удалены — ломают `cmd.exe`):

1. `install.bat` — один раз (зависимости; seed **только если нет** `backend\data\vilar.sqlite`)
2. `start-all.bat` — каждый рабочий день (бэкенд + интерфейс; **не** seed; **не запустит второй экземпляр**, если порты 3001/5173 заняты)  
   `restart-all.bat` — остановить старые процессы и запустить заново  
   Либо: `start-backend.bat` + `start-frontend.bat`
3. `backup.bat` — копия sqlite в `backups\<дата-время>\`

- API: http://localhost:3001  
- UI: http://localhost:5173  

Скрипты: `scripts/install.ps1`, `scripts/start-backend.ps1`, `scripts/start-frontend.ps1`, `scripts/backup-data.ps1`.

В каталоге заказчика `install` = `install.bat`, `run`/`start` = `start-all.bat`. Seed выполняется **на install**, не на run.

## Из корня репозитория

```powershell
npm run setup       # зависимости + seed, если sqlite ещё нет
npm run backend     # Express API (watch)
npm run frontend    # Vite UI
```

## Классический запуск

```powershell
cd backend
npm install
npm run seed:if-needed
npm run dev
# API: http://localhost:3001

cd frontend
npm install
npm run dev
# UI: http://localhost:5173
```

Пересборка демо (уничтожает рабочую базу): `cd backend && npm run seed`

## Переменные
- `PORT` — порт API (по умолчанию 3001)
- `VITE_API_URL` — базовый URL API для фронта (по умолчанию `http://localhost:3001/api`)
- `AUTH_SECRET` — секрет JWT; если не задан, пишется в `backend/data/auth_secret`
- `VILAR_ADMIN_PASSWORD` — пароль пользователя `Admin` при создании БД / при апгрейде слабого `Admin`/`Admin` (не короче 8 символов). **Не коммитьте** боевой пароль. Если не задан при первом создании — в консоль один раз печатается временный пароль.
- `CORS_ORIGIN` — список origin через запятую (по умолчанию `http://localhost:5173,http://127.0.0.1:5173`)
- `SERVE_FRONTEND=1` — вместе с `npm start` раздавать собранный `frontend/dist`

## Релизы и обновления (процесс)

1. Фича/фикс — **новая ветка**, тест **локально**.
2. Если ок → merge в **`main`**, push на GitHub.
3. На пилотной ВМ: бэкап `vilar.sqlite` → `git pull`/`git bundle` (ветка `main`) → при необходимости `npm run install:all` → сборка frontend с `VITE_API_URL` → `sudo systemctl restart vilar-op`.
   Пилот по HTTP (`http://IP`) — не secure context: фронт не должен полагаться на `crypto.randomUUID` без fallback (`frontend/src/utils/id.ts`).
4. Hard refresh браузера (Ctrl+F5) после деплоя фронта.
4. Проверка сайта. Правило агента: `.cursor/rules/releases-and-updates.mdc`.

На ВМ не запускать `npm run seed` вручную. Очистка/демо/слепки — **Администрирование → Данные и резервные копии** (только Admin).

Публичная ВМ: оценка рисков и план (firewall, HTTPS, бэкапы вне ВМ) — `docs/SECURITY_PUBLIC_VM.md`.

## После установки на площадке

1. Задать `VILAR_ADMIN_PASSWORD` **до первого** seed / создания БД (см. переменные ниже). В UI подсказок логина/пароля нет.
2. Войти логином `Admin` и паролем из окружения (или тем, что вывел бэкенд одноразово в консоль, если env не задан).
3. Руководство для сотрудников: **Администрирование → Руководство пользователя** (после смены прав или новых объектов RBAC — `restart-all.bat` и повторный вход).
4. При необходимости задать `AUTH_SECRET` и `CORS_ORIGIN` в окружении.
5. Поставить расписание на `backup.bat`.

## API

- `POST /api/auth/login` — `{ login, password, rememberMe }` (без токена)
- `GET /api/health` — без токена
- Остальные `/api/*` — `Authorization: Bearer …`
- Проведение: `POST /api/documents/:type/:id/post` — userId берётся из токена, не из тела
- `GET /api/quality/documents` — документы качества
- `GET /api/reports/released-series` — отчёт выпущенных серий
- `POST /api/reports/released-series.xlsx` — Excel того же отчёта (тело `{ "ids": [...] }` — необязательный отбор строк)
- `GET /api/reports/stock` — отчёт запасов (строки партия×склад)
- `POST /api/reports/stock.xlsx` — Excel запасов (иерархия + детализация; тело `{ "ids": [...] }`)
- `GET/POST /api/feedback` — обращения; `PUT/DELETE /api/feedback/:id`

Демо-пользователи при seed: логин `Admin` (пароль из `VILAR_ADMIN_PASSWORD` или одноразовый из лога); роли кладовщик, планировщик — см. seed.

## Данные
- Файл БД: `backend/data/vilar.sqlite` (при первом запуске импорт из старых `*.json`, если sqlite пустой)
- JWT: `backend/data/auth_secret`
- Перегенерация демо: `npm run seed` в `backend` — **пересоздаёт sqlite**
- Backup: `backup.bat` или копировать `vilar.sqlite` и при наличии `-wal` / `-shm`
- Excel-выгрузка одной коллекции: `GET /api/export/{collection}.xlsx`
- Экспорт выбранных справочников: `POST /api/admin/export-dictionaries.xlsx` (тело `{ "collections": ["materials", ...] }`)

Чеклист площадки: `docs/PRE_PRODUCTION.md`

Автотесты: `npm test` (из корня или `backend`) — временная sqlite, не `vilar.sqlite`.

## Git
```powershell
git checkout feature/launch-sqlite-reservations
```
