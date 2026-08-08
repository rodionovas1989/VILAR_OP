# Vilar OP — оперативное планирование производства

Система оперативного планирования серий препаратов и резервирования партий сырья для фармпредприятия (GMP).

## Стек

| Слой | Технология | Зачем |
|------|------------|--------|
| Frontend | React + Vite + TypeScript | Веб-интерфейсы CRUD и рабочий стол планирования |
| Backend | Node.js + Express | REST API, файловое хранилище JSON, Excel через `exceljs` |
| Данные | JSON-файлы в `backend/data/` | Быстрый старт; перспектива — SQL (SQLite/Postgres) без смены контракта API |
| Gantt | [frappe-gantt](https://github.com/frappe/gantt) | Загрузка рабочих центров |

Альтернативы бэка (на выбор при миграции): **Python FastAPI + openpyxl** — удобнее тяжёлая аналитика Excel; **NestJS** — если вырастет домен. Текущий Express выбран как наиболее простой для JSON/Excel и единого JS/TS-стека с React.

## Возможности

- Справочники: материалы, спецификации, контрагенты, партии, серии, рабочие центры
- Запасы, резервирование, движения материалов
- Заказы / планы производства со статусами и табличной частью резерва
- Рабочий стол: подбор заказов → подбор сырья (FEFO/FIFO + правило одной партии на компонент) → диаграмма Ганта
- Правила GMP: `docs/GMP_SERIES_RULES.md`

## Быстрый старт

```bash
# Backend
cd backend
npm install
npm run seed    # генерация демо-данных из рецептур
npm run dev     # http://localhost:3001

# Frontend (другой терминал)
cd frontend
npm install
npm run dev     # http://localhost:5173
```

## Структура данных

Отдельный JSON на каждый тип объекта в `backend/data/`. См. `AGENT_BRIEF.md`.

## Документация

- `docs/GMP_SERIES_RULES.md` — правила серий/партий
- `PROJECT_CONTEXT.md` — контекст ветки
- `DEPLOYMENT.md` — запуск
- `AGENT_BRIEF.md` — карта проекта для агентов
- `BRANCH_INFO.md` — ветки
