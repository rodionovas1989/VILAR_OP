# Overview — Vilar OP

**Vilar OP** — оперативное планирование серий ЛП и резервирование партий сырья (GMP) для фармпредприятия ВИЛАР.

- Пилот: https://vilar-prod.ru  
- Эталон кода: ветка `main` (см. [BRANCH_INFO.md](../BRANCH_INFO.md))  
- Стек: React + Vite + TypeScript; Node/Express; SQLite через `node:sqlite` (без native gyp)

## Контур продукта

1. Справочники (материалы, спеки, аналоги, партии, склады, РЦ, техкарты, …)
2. Заказы на производство (оркестратор; не движение запасов)
3. Рабочий стол планирования: подбор → сырьё → Гант → иерархия → матрица
4. Складские документы (RCP…SHP): post / cancel / fulfill
5. Качество (QCM), характеристики партий (LCH), сценарии авто-QCM
6. Отчёты + админ (бэкапы, руководство, «Что нового», обратная связь)

## Ключевые инварианты

- Одна партия сырья на компонент в серии — [concepts/gmp-one-lot-per-component.md](concepts/gmp-one-lot-per-component.md)
- Статусы заказа и guards — [concepts/order-status-machine.md](concepts/order-status-machine.md)
- Потребность: кг на 1000 уп; пересчёт assay/dry — [concepts/lot-recalc-assay-dry.md](concepts/lot-recalc-assay-dry.md)
- Регистры stock/резервы — в основном **только GET**; запись через документы/planning

## Масштаб и ограничения

- Пилот 10–15 пользователей на SQLite WAL — осторожно ок; при росте писателей — Postgres (roadmap)
- Новые фичи — только в новых ветках
- Документация после merge в main — sync rule + обновление wiki

## Навигация для агента

Стартовать с [index.md](index.md). Карта кода: [entities/code-map.md](entities/code-map.md). Запуск: [ops/local-and-pilot.md](ops/local-and-pilot.md). Секреты: [ops/secrets-and-local.md](ops/secrets-and-local.md). Жизненный цикл docs/rules: [concepts/rules-and-docs-lifecycle.md](concepts/rules-and-docs-lifecycle.md).
