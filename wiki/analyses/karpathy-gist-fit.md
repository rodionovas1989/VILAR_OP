# Analysis: соответствие LLM Wiki (gist Карпати)

Сверка с [llm-wiki gist](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) и coding skills. Дата: 2026-08-26.

## Слои gist

| Требование gist | У нас | Оценка |
|-----------------|-------|--------|
| Raw immutable | `docs/*` методики + `raw/`; агент не переписывает | **да** |
| Wiki LLM-owned | `wiki/**` | **да** |
| Schema | `wiki/SCHEMA.md` + `.cursor/rules/wiki-schema.mdc` | **да** |
| Ingest | описан + триггеры sync | **да** (дисциплина сессий) |
| Query → file back | schema + analyses/ | **частично** (мало analyses пока) |
| Lint | сделан первый проход | **да** |
| index.md + log.md | есть | **да** |
| Private / secrets | расширение beyond gist (`local/`, secrets-guard) | **лучше gist** |
| Obsidian / qmd search | нет | **не нужно** на текущем масштабе |
| Coding pitfalls (skills) | `karpathy-guidelines.mdc` | **да** (отдельный трек) |

**Итог:** ~80–85% паттерна wiki для software repo. Не research-vault, а project knowledge base — это нормальная адаптация gist.

## Если вставить gist целиком как User prompt

Gist — **idea file** («скопируй агенту, он сам построит specifics»), не готовый schema под Vilar.

| Эффект | Риск |
|--------|------|
| Дубль с `wiki/SCHEMA.md` и wiki-schema rule | конфликт инструкций, шум в контексте |
| Примеры Personal/Research/Obsidian | агент может предложить перестроить дерево под vault |
| «LLM owns wiki entirely» | конфликт с human pins и raw `docs/` |
| Нет Vilar-специфики (GMP, FE↔BE types, релизы ВМ) | gist их не знает |

**Рекомендация:** gist **не** вставлять в User rules. Держать ссылку в SCHEMA (уже есть). При новой сессии достаточно project rules + `wiki/index.md`. Если очень нужен «промпт» — одна строка: «Следуй `wiki/SCHEMA.md` (паттерн Karpathy LLM Wiki)».
