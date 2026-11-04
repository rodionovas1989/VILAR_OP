# Source: ROADMAP + agent docs bootstrap

- **Канон статуса:** [docs/ROADMAP.md](../../docs/ROADMAP.md) — домены (рабочие места, GMP, качество, отчёты, UI, ИБ, эксплуатация, коммуникации, интеграции); в каждом **Активные** / **Закрыто**.
- **Канон планов:** [docs/plans/](../../docs/plans/) ([README](../../docs/plans/README.md))
- **Прочие:** [AGENT_BRIEF.md](../../AGENT_BRIEF.md), [README.md](../../README.md), [DEPLOYMENT.md](../../DEPLOYMENT.md), [BRANCH_INFO.md](../../BRANCH_INFO.md)
- **Выжимка:** [overview](../overview.md), [code-map](../entities/code-map.md), [ops](../ops/local-and-pilot.md), decisions D001–D015  
- **Хранение:** STOR1 / I1 — [plans/relational-storage-postgres.md](../../docs/plans/relational-storage-postgres.md), [analyses/relational-storage-migration](../analyses/relational-storage-migration.md)
- **Сторно:** R10 / R11 — [plans/storno-stock-documents.md](../../docs/plans/storno-stock-documents.md), [storno-partial-lines.md](../../docs/plans/storno-partial-lines.md); при планировании — сверка планов (`.cursor/rules/roadmap-plans.mdc`)
- **RES / staging:** **G13** — [plans/reservation-pull-list-staging.md](../../docs/plans/reservation-pull-list-staging.md), [D015](../decisions/D015-reservation-pull-list-staging.md), [analyses/reservation-pull-list-staging](../analyses/reservation-pull-list-staging.md)
- **Стол кладовщика:** **WP11** — [plans/warehouse-desktop.md](../../docs/plans/warehouse-desktop.md), [analyses/warehouse-desktop](../analyses/warehouse-desktop.md) (обеспечение = G13-d / волна 5)
- **Качество / типы остатка:** Q10 — [plans/quality-stock-types.md](../../docs/plans/quality-stock-types.md), [D014](../decisions/D014-quality-stock-types.md), [analyses/quality-stock-types](../analyses/quality-stock-types.md), [quality-scenarios-movements](../concepts/quality-scenarios-movements.md)
- **Качество / inspection lot:** Q11 — [analyses/sap-inspection-lot](../analyses/sap-inspection-lot.md) (идея)
- **Качество / пробы:** **Q13** — [analyses/sap-physical-samples](../analyses/sap-physical-samples.md); **допуски LCH:** Q12 идея

## Цикл

1. Строка в домене ROADMAP (статусы: идея / в работе / есть план / процесс / отложено / готово).
2. План → `docs/plans/<slug>.md` + колонка «План» (пример: **Q7** → [lot-attachments.md](../../docs/plans/lot-attachments.md)).
3. Готово → Effort (часы · токены) + перенос в «Закрыто»; wiki/log.

Черновики только в `~/.cursor/plans` не канон. Указатель: [`.cursor/plans/README.md`](../../.cursor/plans/README.md). Rule: [roadmap-plans.mdc](../../.cursor/rules/roadmap-plans.mdc).

## Метрики

Effort в таблице ROADMAP — витрина. Детали — frontmatter плана / `local/roadmap-effort.json`. Агент не подгружает метрики сам.
