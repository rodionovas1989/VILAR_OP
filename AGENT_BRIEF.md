# AGENT_BRIEF

Краткий контекст для агентов — снижать окно контекста.

**Сначала:** `wiki/index.md` → нужные страницы. Схема: `wiki/SCHEMA.md`.  
Этот файл — **карта файлов и API**, не энциклопедия домена (она в wiki).

## Назначение
ОП серий ЛП + резерв сырья (GMP: 1 партия на компонент). Пилот: vilar-prod.ru.

## Структура (якоря)

```
wiki/                    — LLM Wiki (знания агента)
raw/                     — новые исходники ingest (не секреты)
docs/GMP_SERIES_RULES.md, LOT_RECALC.md, ORDER_STATUS_GUARDS.md, STOCK_DOCUMENTS_SPEC.md — raw-методики
package.json / install.bat / start-*.bat / backup.bat / scripts/*.ps1
backend/
  data/vilar.sqlite      — НЕ в git
  src/index.js, store.js, sqlite.js
  src/services/planning.js, documents.js, stock.js, quality.js, characteristics.js,
                substitutions.js, lotRecalc.js, auth.js, permissions.js, …
  src/routes/*.js        — planning, documents, quality, characteristics, reports, admin, …
  tests/chain.test.js, lotRecalc.test.js
frontend/
  src/App.tsx, api.ts, components/*, content/userGuide.ts, constants/navConfig.ts
```

Полные имена ключевых файлов — [wiki/entities/code-map.md](wiki/entities/code-map.md).

## API (сжато)

- CRUD справочников/заказов: `/api/{name}` + RBAC  
- Регистры и коллекции документов — **GET**; запись: `/api/documents/:type`, `/api/planning/*`  
- Качество `/api/quality/*`, характеристики `/api/characteristics/*`, отчёты `/api/reports/*`, админ `/api/admin/*`, feedback `/api/feedback`  
- Типы документов FE↔BE: оба `documentTypes` (нет shared-пакета)

Доменные инварианты: [wiki/concepts/](wiki/concepts/) (статусы, FEFO, пересчёт, документы).

## Правила кода
- Новые фичи — только в новых ветках  
- После изменений: sync docs + **wiki** (см. `.cursor/rules/docs-sync-after-main.mdc`)  
- Числа во фронте — `DecimalInput`  
- Секреты — `.cursor/rules/secrets-guard.mdc`; `npm run wiki:secrets-lint`
