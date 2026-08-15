# Чеклист перед развёртыванием у заказчика

Ветка реализации: `feature/launch-sqlite-reservations`.  
Стабильный снимок UI/документов: `main` (коммит с контуром stock-documents).

## Сделано в этой ветке

- [x] SQLite (`backend/data/vilar.sqlite`), WAL, импорт из JSON при первом запуске
- [x] Единый контур резервов: `спланирован` → RES posted → `active_reservations`
- [x] `completeOrder` → PRI + PRR + fulfill RES (одна транзакция)
- [x] Атомарное проведение: ошибка по строке откатывает stock/movements/статус
- [x] Guards статусов заказа (см. `docs/ORDER_STATUS_GUARDS.md`)
- [x] Auth + RBAC на API (все маршруты кроме login/health); userId проведения из токена
- [x] Generic CRUD по регистрам и документам — только чтение (запись через проведение)
- [x] `AUTH_SECRET` в `backend/data/auth_secret` (или env); предупреждение, если пароль Admin ещё слабый (`Admin`)
- [x] `VILAR_ADMIN_PASSWORD` для bootstrap Admin; подсказок логина/пароля в UI нет
- [x] CORS ограничен origin фронта (`CORS_ORIGIN`, по умолчанию localhost/127.0.0.1:5173)
- [x] Опция `SERVE_FRONTEND=1` — раздача `frontend/dist` с API
- [x] `backup.bat` копирует sqlite (+ wal/shm) в `backups/<дата-время>/`
- [x] `install.bat` / `npm run setup` не перезаписывают sqlite, если база уже есть

## Ещё нужно до боя

| # | Задача | Зачем | Сложность |
|---|--------|--------|-----------|
| 1 | Auth + RBAC на API | **готово** | |
| 2 | Закрыть generic CRUD по регистрам и документам | **готово** | |
| 3 | Задать `VILAR_ADMIN_PASSWORD` до первого seed; не светить пароль в UI | env; одноразовый пароль в логе, если env пуст | низкая |
| 4 | CORS только на origin фронта | **готово** (на площадке задать `CORS_ORIGIN`) | |
| 5 | Production: `npm start` + `frontend/dist` | Скрипт: `SERVE_FRONTEND=1`; ежедневный запуск пока Vite | низкая |
| 6 | Backup `vilar.sqlite` | Скрипт `backup.bat`; **поставить расписание** на площадке | процесс |
| 7 | HTTPS / reverse proxy + ограничение IP / VPN | Если ВМ в интернете — см. `docs/SECURITY_PUBLIC_VM.md` | средняя |
| 7a | Rate limit login, Helmet, бэкапы вне ВМ | Пилот на публичной ВМ | средняя |
| 8 | Журнал аудита (кто провёл) | userId из токена уже пишется в документы; отдельный журнал — позже | |
| 9 | Не запускать `npm run seed` на боевых данных | **готово для install/setup** | |

## Seed vs install / запуск

| Файл | Когда | Seed? |
|------|--------|--------|
| `install.bat` | Один раз (или после обновления библиотек) | Да, **только если нет** `backend/data/vilar.sqlite` |
| `start-all.bat` / `start-backend.bat` / `restart-all.bat` | Каждый рабочий день | **Нет** |
| Первый старт API при пустом sqlite | Импорт старых `*.json`, это **не** `npm run seed` | |
| `cd backend && npm run seed` | Только вручную, чтобы пересобрать демо | **Да, уничтожает БД** |

## Как обновлять на площадке

1. Окно обслуживания, пользователи выходят.
2. `backup.bat` (или остановить backend и скопировать sqlite вручную).
3. Выложить код, `install.bat` при смене зависимостей (seed не тронет существующую базу).
4. `cd frontend && npm run build` если нужна раздача `dist`.
5. `restart-all.bat`.
6. Проверка: login, список документов, проведение тестового черновика, планирование одного заказа.
7. Откат = вернуть файлы из `backups/...` + предыдущий тег git.

## Параллельная работа (текущая модель)

SQLite WAL: много читателей, **один писатель**. Проведение документа и подтверждение резерва берутся блокировкой `BEGIN IMMEDIATE`: второй запрос ждёт до 8 секунд. Два проведения одной партии подряд не «разъедут» свободный остаток (проверка и запись в одной транзакции).

Это **не** полноценный row-lock по партии: вся БД на время записи в exclusive-reserved режиме для writer. Для 3–10 пользователей LAN достаточно. Если очередь растёт — смотреть Postgres.

## Данные

- Файл: `backend/data/vilar.sqlite`
- Старые `*.json` читаются **один раз**, если sqlite пустой, затем источником истины является sqlite.
- Seed: `npm run seed` в backend **пересоздаёт** sqlite.
- Секрет JWT: `backend/data/auth_secret` (не коммитить) или переменная `AUTH_SECRET`.
