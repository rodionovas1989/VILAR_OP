# AGENT_BRIEF

Краткий контекст для агентов — снижать окно контекста.

## Назначение
ОП производства ЛП: серии ГП + резерв партий сырья (GMP: 1 партия сырья на компонент в серии).

## Структура
```
docs/GMP_SERIES_RULES.md     — правила серий
backend/
  scripts/seed.js            — генерация демо из recipes_raw.json
  scripts/recipes_raw.json   — рецептуры
  data/*.json                — хранилище
  src/index.js               — Express API
  src/store.js               — CRUD JSON
  src/services/planning.js   — FEFO/FIFO, резервы, завершение/отмена
  src/routes/planning.js     — /api/planning/*
frontend/
  src/App.tsx                — меню-аккордеон + страницы
  src/components/CrudPage.tsx
  src/components/PlanningDesktop.tsx
  src/components/GanttChart.tsx
```

## Коллекции API `/api/{name}`
materials, specifications, counterparties, lots, series, stock, reservations, work_centers, production_orders, material_movements

Планирование: `/api/planning/select-orders`, `suggest-materials-bulk`, `confirm-materials-bulk`, `gantt`, `complete/:id`, `cancel/:id`

## Статусы заказа
новый → спланирован (резерв) → завершен (движения ±) | отменен (снятие резерва)

## Правила кода
- Новые фичи — только в новых ветках
- После изменений обновлять README, PROJECT_CONTEXT, DEPLOYMENT, AGENT_BRIEF, BRANCH_INFO
