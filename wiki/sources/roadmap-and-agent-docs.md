# Source: ROADMAP + agent docs bootstrap

- **Канон статуса:** [docs/ROADMAP.md](../../docs/ROADMAP.md) — домены (рабочие места, GMP, качество, отчёты, UI, ИБ, эксплуатация, коммуникации, интеграции); в каждом **Активные** / **Закрыто**.
- **Канон планов:** [docs/plans/](../../docs/plans/) ([README](../../docs/plans/README.md))
- **Прочие:** [AGENT_BRIEF.md](../../AGENT_BRIEF.md), [README.md](../../README.md), [DEPLOYMENT.md](../../DEPLOYMENT.md), [BRANCH_INFO.md](../../BRANCH_INFO.md)
- **Выжимка:** [overview](../overview.md), [code-map](../entities/code-map.md), [ops](../ops/local-and-pilot.md), decisions D001–D008

## Цикл

1. Строка в домене ROADMAP (статусы: идея / в работе / есть план / процесс / отложено / готово).
2. План → `docs/plans/<slug>.md` + колонка «План» (пример: **Q7** → [lot-attachments.md](../../docs/plans/lot-attachments.md)).
3. Готово → Effort (часы · токены) + перенос в «Закрыто»; wiki/log.

Черновики только в `~/.cursor/plans` не канон. Указатель: [`.cursor/plans/README.md`](../../.cursor/plans/README.md). Rule: [roadmap-plans.mdc](../../.cursor/rules/roadmap-plans.mdc).

## Метрики

Effort в таблице ROADMAP — витрина. Детали — frontmatter плана / `local/roadmap-effort.json`. Агент не подгружает метрики сам.
