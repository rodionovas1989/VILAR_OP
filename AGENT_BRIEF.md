# AGENT_BRIEF

Краткий контекст для агентов — снижать окно контекста.

## Назначение
ОП производства ЛП: серии ГП + резерв партий сырья (GMP: 1 партия сырья на компонент в серии).

## Структура
```
docs/GMP_SERIES_RULES.md     — правила серий
package.json                 — корневые npm-скрипты (backend/frontend/setup)
install.bat / start-*.bat / restart-all.bat / backup.bat — установка, запуск, копия sqlite
scripts/port-guard.ps1       — проверка портов 3001/5173 (защита от дублирования)
scripts/*.ps1                — install / start-backend / start-frontend / start-all / restart-all / backup-data
backend/
  scripts/seed.js            — генерация демо из recipes_raw.json (пересоздаёт sqlite)
  scripts/seed-if-needed.js  — seed только если нет vilar.sqlite
  scripts/recipes_raw.json   — рецептуры
  data/vilar.sqlite          — хранилище SQLite (WAL)
  src/index.js               — Express API (auth, CORS, опционально frontend/dist)
  src/sqlite.js              — обёртка node:sqlite (без better-sqlite3 / node-gyp)
  src/routes/admin.js            — экспорт словарей; backups / clear / demo
  src/services/dataMaintenance.js — слепки sqlite, очистка, демо-seed
  src/services/auth.js           — login/JWT; warnIfDefaultAdminPassword
  src/utils/adminBootstrap.js    — VILAR_ADMIN_PASSWORD / временный пароль Admin
  src/utils/password.js          — scrypt hash
  src/store.js               — CRUD SQLite (JSON-документы в таблице records); bootstrap Admin
  src/middleware/access.js   — JWT + RBAC на маршрутах
  src/constants/collectionAccess.js — коллекция → objectId; запрет generic-записи регистров
  src/services/stock.js      — свободный остаток, склады
  src/services/planning.js   — FEFO/FIFO, RES, completeOrder→PRI/PRR
  src/services/documents.js  — складские документы, проведение, повторное проведение, нумерация
  src/services/quality.js    — качество (заглушка)
  src/constants/documentTypes.js
  src/routes/planning.js     — /api/planning/* (+ GET order-trace/:id)
  src/routes/documents.js    — /api/documents/* (+ GET :id/related)
  tests/chain.test.js        — автотесты: приёмка, RES, completeOrder, guards
  src/routes/quality.js      — /api/quality/*
  src/routes/reports.js      — /api/reports/* (выпущенные серии, запасы, Excel)
  src/services/reports.js
  src/routes/feedback.js     — /api/feedback
  src/services/feedback.js
  src/constants/systemObjects.js — объекты RBAC (справочники, документы, заказы, отчеты)
  src/services/permissions.js    — матрица прав роли
  src/services/favorites.js      — избранное per user (+ RBAC filter)
  src/constants/navPages.js      — pageId → objectId для избранного
  src/routes/admin.js        — /api/admin/* (экспорт справочников)
  data/roles.json
  docs/ORDER_STATUS_GUARDS.md
  docs/PRE_PRODUCTION.md
  docs/SECURITY_PUBLIC_VM.md — публичная ВМ: риски и план (SG, HTTPS, rate limit, бэкапы)
frontend/
  src/App.tsx                — меню: одна открытая подсистема (аккордеон) + страницы
  src/components/CrudPage.tsx
  src/components/PlanningDesktop.tsx  — вкладки 1–5
  src/components/GanttChart.tsx       — Apache ECharts, дорожки = РЦ
  src/components/SpecLinesEditor.tsx      — ТЧ рецептуры
  src/components/SpecSuppliersEditor.tsx  — регистрация поставщиков
  src/components/SpecDetailTabs.tsx       — вкладки Рецептура / Поставщики
  src/components/CounterpartyBadge.tsx    — зелёный/жёлтый бейдж
  src/components/ProductionDesktop.tsx       — управление заказами (план/факт)
  src/components/AdminExportDictionaries.tsx — экспорт справочников
  src/components/AdminDataMaintenance.tsx — очистка / демо / резервные копии
  src/components/ColumnFilterDropdown.tsx    — отбор колонки (чекбоксы)
  src/components/ColumnFilterList.tsx        — чекбоксы отбора (inline)
  src/components/ListViewSettings.tsx        — панель отбора и сортировки списка
  src/components/DocumentTypePage.tsx    — страница одного типа документа (date+time, actions menu, user labels)
  src/utils/id.ts                        — newId(): UUID с fallback на http://IP (не secure context)
  src/components/DocumentTracePanel.tsx  — движения и связи
  src/components/DocumentTraceModal.tsx  — отдельное окно по пиктограмме у статуса
  src/constants/navConfig.ts           — навигация + каталог pageId/kind
  src/auth/FavoritesContext.tsx        — избранное пользователя
  src/components/AppHeader.tsx
  src/components/AuthGate.tsx            — гостевой экран только «Вход» (без бренда)
  src/components/HomePage.tsx          — главная: колонки по типу объекта, избранное вертикально
  src/components/ReleasedSeriesReportPage.tsx — отчёт выпущенных серий
  src/components/StockReportPage.tsx         — отчёт запасов (иерархия)
  src/components/FeedbackPage.tsx            — обращения (обратная связь)
  src/components/UserGuidePage.tsx           — руководство: инструкция + FAQ
  src/content/userGuide.ts                   — текст руководства
  src/content/userGuideTypes.ts
  src/hooks/useListTable.ts            — фильтр + сортировка списков (persist per user)
  src/components/ListTableHeader.tsx   — шапка таблицы с фильтром/сортировкой
  src/components/PageTitle.tsx         — заголовок + ☆
  src/components/ProductionOrderPage.tsx — заказы на производство (модалка как документ)
  src/components/RolesPage.tsx           — роли + матрица прав
  src/components/PermissionMatrix.tsx
  src/auth/permissions.ts                — проверка read/create/modify
  src/constants/systemObjects.ts
  src/components/QualityDocumentsPage.tsx  — качество (заглушка)
  src/components/IconButton.tsx              — кнопки-пиктограммы действий
```

## Коллекции API `/api/{name}`
Справочники и заказы — полный CRUD (с RBAC).  
Регистры (`stock`, `active_reservations`, движения, качество) и коллекции документов — **только GET**; запись через `/api/documents/:type` и `/api/planning`.

Документы API: `/api/documents/:type` (`receipt`, `reservation`, `production_issue`, …)  
Связи: `GET /api/documents/:type/:id/related`, `GET /api/planning/order-trace/:id`

Спецификация: `name`, `type`, `qtyBasis: per1000`, `lines` (`qtyPerUnit` = кг на 1000 уп), `approvedSuppliers`
Расход компонента (план): `need = qtyPerUnit * order.quantity / 1000`

Планирование: `/api/planning/...`  
Производство: `POST /api/planning/production-fact/:id`, `POST /api/planning/complete/:id` (по факту)  
Администрирование: `GET /api/admin/dictionaries`, `POST /api/admin/export-dictionaries.xlsx`,
`GET/POST /api/admin/backups`, `POST .../restore`, `DELETE ...`, `POST /api/admin/data/clear|demo`
Обратная связь: `/api/feedback` (свои записи; модератор — все)  
Руководство пользователя: страница `admin_user_guide` (чтение у admin/planner/storekeeper)  
Отчеты: `GET /api/reports/released-series`, `POST /api/reports/released-series.xlsx`, `GET /api/reports/stock`, `POST /api/reports/stock.xlsx`

## Плановые объёмы серий
Срез `materialId + workCenterId → quantity`. При создании заказа количество подставляется из среза (можно править вручную).

## Статусы заказа
новый → (выбор на вкладке 1 без смены статуса) → спланирован (подтверждение резерва на вкладке 2) → завершен (движения ±) | отменен (снятие резерва)

Единая сущность планирования: **заказ на производство** (отдельного «плана производства» нет).

## Рабочий стол (вкладки)
1. Подбор заказов  
2. Подбор сырья (бейдж контрагента: зелёный = одобрен в спецификации, жёлтый = нет)  
3. Гант (ECharts: параллельная загрузка по РЦ)  
4. Иерархия заказов/материалов (та же индикация; фильтры, печать, Excel)  
5. Матрица планового расхода

## Правила кода
- Новые фичи — только в новых ветках
- После изменений обновлять README, PROJECT_CONTEXT, DEPLOYMENT, AGENT_BRIEF, BRANCH_INFO
