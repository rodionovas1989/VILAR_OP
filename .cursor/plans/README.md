# Планы Cursor в этом проекте

**Канон планов — в git:** [`docs/plans/`](../../docs/plans/).

Не храните единственную копию плана только в `%USERPROFILE%\.cursor\plans` (или `~/.cursor/plans`): при смене ПК и у другого клона репозитория файла не будет.

## Как работать

1. Новый пункт → строка в `docs/ROADMAP.md`.
2. Готовый план → создать/обновить `docs/plans/<slug>.md`.
3. В ROADMAP: статус **есть план** + относительная ссылка на файл.
4. Project rules — только [`.cursor/rules/`](../rules/) в репозитории.

Правило агента: [roadmap-plans.mdc](../rules/roadmap-plans.mdc).
