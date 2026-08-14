# AGENT_BRIEF

Краткий контекст для агентов — снижать окно контекста.

## Назначение
ОП производства ЛП: серии ГП + резерв партий сырья (GMP: 1 партия сырья на компонент в серии).

## Структура
```
docs/GMP_SERIES_RULES.md     — правила серий
package.json                 — корневые npm-скрипты (backend/frontend/setup)
install.bat / start-*.bat / restart-all.bat — установка и запуск (ASCII; кириллица ломает cmd)
scripts/port-guard.ps1       — проверка портов 3001/5173 (защита от дублирования)
scripts/*.ps1                — install / start-backend / start-frontend / start-all / restart-all
backend/
  scripts/seed.js            — генерация демо из recipes_raw.json
  scripts/recipes_raw.json   — рецептуры
  data/*.json                — хранилище
  src/index.js               — Express API
  src/store.js               — CRUD JSON
  src/services/planning.js   — FEFO/FIFO, резервы, матрица остатков
  src/services/documents.js  — складские документы, проведение, повторное проведение, нумерация
  src/services/quality.js    — качество (заглушка)
  src/constants/documentTypes.js
  src/routes/planning.js     — /api/planning/*
  src/routes/documents.js    — /api/documents/*
  src/routes/quality.js      — /api/quality/*
  src/constants/systemObjects.js — объекты RBAC (справочники, документы, заказы)
  src/services/permissions.js    — матрица прав роли
  src/services/favorites.js      — избранное per user (+ RBAC filter)
  src/constants/navPages.js      — pageId → objectId для избранного
  src/routes/admin.js        — /api/admin/* (экспорт справочников)
  data/roles.json
frontend/
  src/App.tsx                — меню-аккордеон + страницы
  src/components/CrudPage.tsx
  src/components/PlanningDesktop.tsx  — вкладки 1–5
  src/components/GanttChart.tsx       — Apache ECharts, дорожки = РЦ
  src/components/SpecLinesEditor.tsx      — ТЧ рецептуры
  src/components/SpecSuppliersEditor.tsx  — регистрация поставщиков
  src/components/SpecDetailTabs.tsx       — вкладки Рецептура / Поставщики
  src/components/CounterpartyBadge.tsx    — зелёный/жёлтый бейдж
  src/components/ProductionDesktop.tsx       — управление заказами (план/факт)
  src/components/AdminExportDictionaries.tsx — экспорт справочников
  src/components/ColumnFilterDropdown.tsx    — отбор колонки (чекбоксы)
  src/components/ColumnFilterList.tsx        — чекбоксы отбора (inline)
  src/components/ListViewSettings.tsx        — панель отбора и сортировки списка
  src/components/DocumentTypePage.tsx    — страница одного типа документа (date+time, actions menu, user labels)
  src/constants/navConfig.ts           — навигация + каталог pageId/kind
  src/auth/FavoritesContext.tsx        — избранное пользователя
  src/components/HomePage.tsx          — главная: колонки по типу объекта, избранное вертикально
  src/hooks/useListTable.ts            — фильтр + сортировка списков
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
materials, ... **receipt_documents**, **reservation_documents**, … (9 typed doc collections), **users**, **user_favorites**, active_reservations, reservation_history, material_movements

Документы API: `/api/documents/:type` (`receipt`, `reservation`, `production_issue`, …)

Спецификация: `name`, `type`, `qtyBasis: per1000`, `lines` (`qtyPerUnit` = кг на 1000 уп), `approvedSuppliers`
Расход компонента (план): `need = qtyPerUnit * order.quantity / 1000`

Планирование: `/api/planning/...`  
Производство: `POST /api/planning/production-fact/:id`, `POST /api/planning/complete/:id` (по факту)  
Администрирование: `GET /api/admin/dictionaries`, `POST /api/admin/export-dictionaries.xlsx`

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
