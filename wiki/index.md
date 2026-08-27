# Wiki index — Vilar OP

Каталог для агента. Читать **первым**, затем drill-down. Схема: [SCHEMA.md](SCHEMA.md). Лог: [log.md](log.md).

## Корень

| Страница | Summary |
|----------|---------|
| [overview.md](overview.md) | Продукт, контур, инварианты, пилот |
| [SCHEMA.md](SCHEMA.md) | Слои, ingest/query/lint, переход от старых docs |

## Concepts

| Страница | Summary |
|----------|---------|
| [gmp-one-lot-per-component](concepts/gmp-one-lot-per-component.md) | Одна партия сырья на компонент в серии |
| [fefo-fifo-picking](concepts/fefo-fifo-picking.md) | FEFO/FIFO, годность, свободный остаток |
| [order-status-machine](concepts/order-status-machine.md) | новый → спланирован → завершен/отменен |
| [lot-recalc-assay-dry](concepts/lot-recalc-assay-dry.md) | кг/1000 уп + пересчёт содержания/потери |
| [soft-vs-hard-supplier-approval](concepts/soft-vs-hard-supplier-approval.md) | Мягкие бейджи поставщиков |
| [substitutions-no-transitivity](concepts/substitutions-no-transitivity.md) | Прямые аналоги без цепочек |
| [document-lifecycle](concepts/document-lifecycle.md) | Типы док-тов, post/cancel/fulfill |
| [inv-plan-fact-wof-pst](concepts/inv-plan-fact-wof-pst.md) | INV → черновики WOF/PST |
| [rules-and-docs-lifecycle](concepts/rules-and-docs-lifecycle.md) | Cursor rules, судьба MD, триггеры wiki |
| [legal-pdn](concepts/legal-pdn.md) | ПДн, согласие, без саморегистрации |
| [qbl-soft-block](concepts/qbl-soft-block.md) | QBL мягкий карантин партии |
| [tech-maps-series-planning](concepts/tech-maps-series-planning.md) | Техкарты, объёмы серий, plan-series |

## Entities

| Страница | Summary |
|----------|---------|
| [production-order](entities/production-order.md) | Заказ-оркестратор |
| [reservation-res](entities/reservation-res.md) | Резерв RES |
| [pri-prr-complete](entities/pri-prr-complete.md) | Complete: PRI+PRR |
| [stock-registers](entities/stock-registers.md) | Регистры read-mostly |
| [qcm-quality](entities/qcm-quality.md) | Документ качества / сценарии |
| [lch-characteristics](entities/lch-characteristics.md) | LCH, регистр, рабочий стол качества |
| [decimal-input](entities/decimal-input.md) | Единый числовой ввод |
| [rbac-objects](entities/rbac-objects.md) | Права и objectId |
| [code-map](entities/code-map.md) | Якоря по коду (brief тонкий) |
| [feedback-tickets](entities/feedback-tickets.md) | Обращения FB-… |
| [production-register](entities/production-register.md) | Аналитика PRI/PRR |
| [ops-debug](entities/ops-debug.md) | ops_debug.jsonl |
| [login-audit](entities/login-audit.md) | Журнал входов + status log |
| [changelog-feed](entities/changelog-feed.md) | CHANGELOG → «Что нового» |

## Decisions

| Страница | Summary |
|----------|---------|
| [D001](decisions/D001-sqlite-builtin.md) | node:sqlite без gyp |
| [D002](decisions/D002-order-as-orchestrator.md) | Заказ ≠ движение |
| [D003](decisions/D003-soft-supplier-approval.md) | Мягкие поставщики |
| [D004](decisions/D004-cookie-auth.md) | Cookie + Bearer |
| [D005](decisions/D005-decimal-input.md) | DecimalInput везде |
| [D006](decisions/D006-docs-sync-after-main.md) | Sync docs после main |
| [D007](decisions/D007-llm-wiki.md) | Внедрение LLM Wiki |
| [D008](decisions/D008-rules-secrets-lifecycle.md) | Rules, секреты, lifecycle wiki |
| [D009](decisions/D009-multi-warehouse-pri.md) | N RES/PRI по складам; склад в строке факта |
| [D010](decisions/D010-same-lot-multi-warehouse.md) | Одна партия на нескольких складах: пока TRN; авто-сплит отложен |

## Ops

| Страница | Summary |
|----------|---------|
| [local-and-pilot](ops/local-and-pilot.md) | bat/npm, HTTPS, бэкапы, тесты |
| [secrets-and-local](ops/secrets-and-local.md) | `local/`, env, профилактика утечек |
| [security-pilot](ops/security-pilot.md) | Саммари ИБ пилота |

## Sources (саммари на raw)

| Страница | Канон |
|----------|-------|
| [gmp-series-rules](sources/gmp-series-rules.md) | `docs/GMP_SERIES_RULES.md` |
| [order-status-guards](sources/order-status-guards.md) | `docs/ORDER_STATUS_GUARDS.md` |
| [lot-recalc](sources/lot-recalc.md) | `docs/LOT_RECALC.md` |
| [stock-documents-spec](sources/stock-documents-spec.md) | `docs/STOCK_DOCUMENTS_SPEC.md` |
| [roadmap-and-agent-docs](sources/roadmap-and-agent-docs.md) | ROADMAP, AGENT_BRIEF, README, … |
| [security-and-https](sources/security-and-https.md) | SECURITY_PUBLIC_VM, HTTPS_SETUP |
| [legal-pdn](sources/legal-pdn.md) | LEGAL_PDN |

## Analyses

| Страница | Summary |
|----------|---------|
| [README](analyses/README.md) | Куда класть синтез из query |
| [lint-2026-08-26](analyses/lint-2026-08-26.md) | Первый полный lint |
| [karpathy-gist-fit](analyses/karpathy-gist-fit.md) | Сверка с gist / вставка промпта |
| [lot-leftover-tails](analyses/lot-leftover-tails.md) | «Хвосты» партий: модалка на подборе (G9 готово) |