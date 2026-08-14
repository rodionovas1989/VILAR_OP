# DEPLOYMENT

## Требования
- Node.js 20+ (портативный `.tools/node` или системный)
- npm

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
- `CORS_ORIGIN` — список origin через запятую (по умолчанию `http://localhost:5173,http://127.0.0.1:5173`)
- `SERVE_FRONTEND=1` — вместе с `npm start` раздавать собранный `frontend/dist`

## После установки на площадке

1. Войти как Admin / Admin, открыть **Пользователи**, сменить пароль Admin.
2. Руководство для сотрудников: **Администрирование → Руководство пользователя** (после смены прав или новых объектов RBAC — `restart-all.bat` и повторный вход).
3. При необходимости задать `AUTH_SECRET` и `CORS_ORIGIN` в окружении.
4. Поставить расписание на `backup.bat`.

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

Демо-пользователи при seed: `Admin` / `Admin` (и роли кладовщик, планировщик — см. seed).

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
