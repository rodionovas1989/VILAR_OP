# D008 — Правила, секреты, жизненный цикл вики

**Решение:**

1. Глобальные Cursor user rules — только кросс-проектное; Vilar — в `.cursor/rules/` + `wiki/SCHEMA.md`.
2. Секреты и `local/` никогда не ingest’ятся в wiki содержимым; только указатели.
3. Методики в `docs/` и README/DEPLOYMENT/CHANGELOG/ROADMAP/BRANCH_INFO остаются; AGENT_BRIEF и PROJECT_CONTEXT ужимаются.
4. Актуализация wiki — через явные триггеры (merge main, ingest, query-file, lint), не фоновый демон.

**Связано:** [rules-and-docs-lifecycle](../concepts/rules-and-docs-lifecycle.md), [secrets-and-local](../ops/secrets-and-local.md), [D006](D006-docs-sync-after-main.md), [D007](D007-llm-wiki.md)
