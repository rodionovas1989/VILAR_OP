# AGENT_BRIEF

Краткий контекст для агентов — снижать окно контекста.

## Назначение
ОП производства ЛП: серии ГП + резерв партий сырья (GMP: 1 партия сырья на компонент в серии).

## Структура
```
docs/GMP_SERIES_RULES.md     — правила серий
package.json                 — корневые npm-скрипты (backend/frontend/setup)
install.bat / start-*.bat    — установка и запуск (ASCII; кириллица ломает cmd)
scripts/*.ps1                — install / start-backend / start-frontend
backend/
  scripts/seed.js            — генерация демо из recipes_raw.json
  scripts/recipes_raw.json   — рецептуры
  data/*.json                — хранилище
  src/index.js               — Express API
  src/store.js               — CRUD JSON
  src/services/planning.js   — FEFO/FIFO, резервы, матрица остатков
  src/routes/planning.js     — /api/planning/*
  src/routes/admin.js        — /api/admin/* (экспорт справочников)
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
  src/components/IconButton.tsx              — кнопки-пиктограммы действий
```

## Коллекции API `/api/{name}`
materials, specifications, counterparties, lots, series, **warehouses**, stock (+warehouseId), reservations, work_centers, planned_series_volumes, production_orders (quantity/lines + actualQuantity/actualLines), material_movements

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
