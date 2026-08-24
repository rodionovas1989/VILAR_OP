# AGENT_BRIEF

Краткий контекст для агентов — снижать окно контекста.

## Назначение
ОП производства ЛП: серии ГП + резерв партий сырья (GMP: 1 партия сырья на компонент в серии).

## Структура
```
docs/GMP_SERIES_RULES.md     — правила серий
docs/LOT_RECALC.md           — методика пересчёта по содержанию и потере при высушивании
package.json                 — корневые npm-скрипты (backend/frontend/setup)
install.bat / start-*.bat / restart-all.bat / backup.bat — установка, запуск, копия sqlite
scripts/port-guard.ps1       — проверка портов 3001/5173 (защита от дублирования)
scripts/*.ps1                — install / start-backend / start-frontend / start-all / restart-all / backup-data
backend/
  scripts/seed.js            — генерация демо из recipes_raw.json (пересоздаёт sqlite)
  scripts/seed-if-needed.js  — seed только если нет vilar.sqlite
  scripts/recipes_raw.json   — демо-рецептуры
  scripts/customer_recipes.json — производственные рецептуры ВИЛАР
  scripts/import-customer-recipes.js — очистка + загрузка (`--force`)
  data/vilar.sqlite          — хранилище SQLite (WAL)
  src/index.js               — Express API (auth, CORS, опционально frontend/dist)
  src/sqlite.js              — обёртка node:sqlite (без better-sqlite3 / node-gyp)
  src/routes/admin.js            — экспорт словарей; backups / clear / demo / customer-recipes
  src/services/dataMaintenance.js — слепки sqlite, очистка, демо, рецептуры ВИЛАР
  src/services/auth.js           — login; httpOnly cookie + переходный Bearer
  src/utils/adminBootstrap.js    — VILAR_ADMIN_PASSWORD / временный пароль Admin
  src/utils/password.js          — scrypt hash
  src/store.js               — CRUD SQLite (JSON-документы в таблице records); bootstrap Admin
  src/middleware/access.js   — cookie/Bearer + RBAC на маршрутах
  src/middleware/loginRateLimit.js — лимит попыток POST /auth/login (IP + логин)
  src/constants/collectionAccess.js — коллекция → objectId; запрет generic-записи регистров
  src/services/stock.js      — свободный остаток, склады
  src/services/planning.js   — FEFO/FIFO, RES, completeOrder→PRI/PRR; аналоги и пересчёт в подборе
  src/services/lotRecalc.js      — пересчёт потребности по эталону и регистру характеристик
  src/constants/lotCharacteristics.js — системные assay / loss_on_drying
  src/services/characteristics.js — LCH документ, регистры состояния/истории
  src/services/substitutions.js — правила замены материалов (без транзитивности)
  src/services/productionRegister.js — движения PRI/PRR (расход/выпуск) + заказ/серия/документ
  src/middleware/opsDebug.js — middleware + error handler
  src/services/documentStatusLog.js — журнал статусов складских документов
  src/services/customerRecipes.js — загрузка рецептур ВИЛАР из customer_recipes.json
  src/services/documents.js  — складские документы, проведение, повторное проведение, нумерация
  src/services/quality.js    — качество: QCM документ, регистры, resolveLotQuality
  src/services/scenarios.js  — сценарии: onLotCreated → авто-QCM
  src/services/referentialIntegrity.js — запрет удаления справочников при наличии ссылок
  src/constants/lotQuality.js — разрешения Годен / Условно / Не годен
  src/services/chat.js       — общий чат
  src/constants/documentTypes.js
  src/routes/planning.js     — /api/planning/* (+ GET order-trace/:id)
  src/routes/documents.js    — /api/documents/* (+ GET :id/related)
  tests/chain.test.js        — автотесты: приёмка, RES, completeOrder, guards
  tests/lotRecalc.test.js    — формула содержания/потери, LCH регистр, подбор
  src/routes/quality.js      — /api/quality/*
  src/routes/characteristics.js — /api/characteristics/*
  src/routes/chat.js         — /api/chat/*
  src/routes/reports.js      — /api/reports/* (серии, запасы, качество запасов/история, Excel)
  src/services/reports.js
  src/routes/feedback.js     — /api/feedback
  src/services/feedback.js
  src/constants/systemObjects.js — объекты RBAC (справочники, документы, заказы, отчеты)
  src/services/permissions.js    — матрица прав роли
  src/services/favorites.js      — избранное per user (+ RBAC filter)
  src/constants/navPages.js      — pageId → objectId для избранного
  src/routes/admin.js        — /api/admin/* (экспорт, backups, login-audit, changelog)
  data/roles.json
  docs/ORDER_STATUS_GUARDS.md
  docs/PRE_PRODUCTION.md
  docs/SECURITY_PUBLIC_VM.md — публичная ВМ: риски и план (SG, HTTPS, rate limit, бэкапы)
  docs/HTTPS_SETUP.md — домен + Let’s Encrypt + nginx на ВМ
frontend/
  src/App.tsx                — меню: одна открытая подсистема (аккордеон) + страницы
  src/components/CrudPage.tsx
  src/components/PlanningDesktop.tsx  — вкладки 1–5
  src/components/SeriesPlanningPage.tsx — планирование серий (объём на период)
  src/components/GanttChart.tsx       — Apache ECharts, дорожки = РЦ
  src/components/SpecLinesEditor.tsx      — ТЧ рецептуры (эталон содержания)
  src/components/CharacteristicForm.tsx   — справочник характеристик + применение
  src/components/CharacteristicManagementPage.tsx — документ LCH
  src/components/SubstitutionForm.tsx     — карточка аналогов (шапка + ТЧ)
  src/components/SpecSuppliersEditor.tsx  — регистрация поставщиков
  src/components/SpecDetailTabs.tsx       — вкладки Рецептура / Поставщики
  src/components/CounterpartyBadge.tsx    — зелёный/жёлтый бейдж (контрагент / производитель)
  src/components/ProductionDesktop.tsx       — управление заказами (план/факт)
  src/components/PlanFactReportPage.tsx      — отчёт План/Факт
  src/components/AdminExportDictionaries.tsx — экспорт справочников
  src/components/AdminDataMaintenance.tsx — очистка / демо / резервные копии (+ скачать на ПК)
  src/components/AdminLoginAuditPage.tsx — журнал входов
  src/components/AdminChangelogPage.tsx — что нового (CHANGELOG.md)
  src/components/HeaderChat.tsx — чат в шапке
  src/components/QualityManagementPage.tsx — единый документ качества
  src/components/QualityScenariosPage.tsx — сценарии: авто-QCM при создании партии
  src/content/userGuide.ts                — руководство пользователя (Админ → Руководство)
  src/content/legal/                      — Политика ПДн, cookies, дисклеймер (версия PDN_POLICY_VERSION)
  docs/LEGAL_PDN.md                       — оргчеклист и модель согласия без саморегистрации
  src/components/ColumnFilterDropdown.tsx    — отбор колонки (чекбоксы)
  src/components/ColumnFilterList.tsx        — чекбоксы отбора (inline)
  src/components/ListViewSettings.tsx        — панель отбора и сортировки списка
  src/components/DocumentTypePage.tsx    — страница одного типа документа (date+time, actions menu, user labels)
  src/utils/id.ts                        — newId(): UUID с fallback на http://IP (не secure context)
  src/components/DocumentTracePanel.tsx  — движения и связи
  src/components/DocumentTraceModal.tsx  — отдельное окно по пиктограмме у статуса
  src/constants/navConfig.ts           — навигация + каталог pageId/kind
  src/auth/FavoritesContext.tsx        — избранное пользователя
  src/auth/RecentObjectsContext.tsx    — последние открытые (полоска под шапкой)
  src/components/RecentObjectsStrip.tsx
  src/components/AppHeader.tsx
  src/hooks/useRecentEntityBridge.ts   — deep-open / close из полоски
  src/components/AuthGate.tsx            — гостевой экран только «Вход» (без бренда)
  src/components/HomePage.tsx          — главная: колонки по типу объекта, избранное вертикально
  src/components/ReleasedSeriesReportPage.tsx — отчёт выпущенных серий
  src/components/StockReportPage.tsx         — отчёт запасов (иерархия)
  src/components/QualityStockReportPage.tsx  — качество запасов
  src/components/QualityHistoryReportPage.tsx — история качеств
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
  src/components/IconButton.tsx              — кнопки-пиктограммы действий
```

## Коллекции API `/api/{name}`
Справочники и заказы — полный CRUD (с RBAC).  
Регистры (`stock`, `active_reservations`, движения, качество) и коллекции документов — **только GET**; запись через `/api/documents/:type` и `/api/planning`.

Документы API: `/api/documents/:type` (`receipt`, `reservation`, `production_issue`, …)  
Связи: `GET /api/documents/:type/:id/related`, `GET /api/planning/order-trace/:id`

Спецификация: `name`, `type`, `qtyBasis: per1000`, `lines` (`id`, `qtyPerUnit` = кг на 1000 уп, `recalcMethod`/`recalcXLabel` = эталон), `approvedSuppliers` (тройка materialId+counterpartyId+manufacturerId), `techMapId`  
Аналоги (`substitutions`): `baseMaterialId`, `lines` (материал-аналог, factor, priority), `bidirectional`, `specificationId` (null = все)  
Характеристики: справочник `lot_characteristics` (system/user, применение = поля LCH и право на пересчёт); документ LCH; регистр `characteristic_register`. Системные код/название/единица не меняются. Партия: `counterpartyId`, `manufacturerId` (без аналитических реквизитов).  
Техкарта (`tech_maps`): `name`, `workCenterId`  
Расход компонента (план): `need = qtyPerUnit * order.quantity / 1000`; при `assay_and_dry` только коэффициенты из применения: `need × (эталон / содержание) × (100 / (100 − потеря))`. Нет факта — эталон и потеря 0 % + warning, без стопа. Методика: `docs/LOT_RECALC.md`.

Планирование: `/api/planning/...` (+ `POST /plan-series` — массовые заказы «новый»)  
Производство: `POST /api/planning/production-fact/:id`, `POST /api/planning/complete/:id` (по факту)  
Администрирование: `GET /api/admin/dictionaries`, `POST /api/admin/export-dictionaries.xlsx`,
`GET/POST /api/admin/backups`, `POST .../restore`, `DELETE ...`, `POST /api/admin/data/clear|demo|customer-recipes`
Обратная связь: `/api/feedback` (свои записи; модератор — все)  
Руководство пользователя: страница `admin_user_guide` (чтение у admin/planner/storekeeper)  
Отчеты: `GET /api/reports/released-series`, `POST .../released-series.xlsx`, `GET /api/reports/stock`, `POST .../stock.xlsx`, `GET /api/reports/quality-stock`, `POST .../quality-stock.xlsx`, `GET /api/reports/quality-history`, `POST .../quality-history.xlsx`

## Плановые объёмы серий
Срез `materialId + workCenterId → quantity`. При создании заказа количество подставляется из среза (можно править вручную).

## Статусы заказа
новый → (выбор на вкладке 1 без смены статуса) → спланирован (подтверждение резерва на вкладке 2) → завершен (движения ±) | отменен (снятие резерва)

Единая сущность планирования: **заказ на производство** (отдельного «плана производства» нет).

## Рабочий стол (вкладки)
1. Подбор заказов  
2. Подбор сырья (отдельные столбцы: контрагент и производитель; зелёный/жёлтый независимо)  
3. Гант (ECharts: параллельная загрузка по РЦ)  
4. Иерархия заказов/материалов (та же индикация; фильтры, печать, Excel)  
5. Матрица планового расхода

## Правила кода
- Новые фичи — только в новых ветках
- После изменений обновлять README, PROJECT_CONTEXT, DEPLOYMENT, AGENT_BRIEF, BRANCH_INFO
