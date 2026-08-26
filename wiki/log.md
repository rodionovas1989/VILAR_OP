# Wiki log

Append-only. Префикс для grep: `## [YYYY-MM-DD]`.

## [2026-08-26] ingest | Bootstrap from existing docs

Созданы `wiki/` + `raw/README.md`, schema/rules (wiki + karpathy guidelines).  
Скомпилированы overview, 8 concepts, 9 entities, 7 decisions, ops, 5 source-cards из `docs/*` + AGENT_BRIEF/ROADMAP/README/DEPLOYMENT.  
Старые файлы не удалялись; методики в `docs/` = raw-by-convention.

## [2026-08-26] query | Rules, secrets, wiki lifecycle

Зафиксированы ответы: иерархия Cursor rules; секреты/`local/` вне wiki; какие MD остаются; актуализация по триггерам (не демон).  
Страницы: `concepts/rules-and-docs-lifecycle`, `ops/secrets-and-local`, `decisions/D008`; обновлены SCHEMA и project rules.

## [2026-08-26] ingest | Secrets guard + SECURITY/LEGAL + thin AGENT_BRIEF

Добавлены `.cursor/rules/secrets-guard.mdc`, `npm run wiki:secrets-lint`, профилактика в ops/secrets.  
Ingest: `ops/security-pilot`, `concepts/legal-pdn` + sources.  
`AGENT_BRIEF.md` ужат до карты/API со ссылками на wiki.

## [2026-08-26] lint | Full wiki health-check

**OK:** secrets-lint; index ↔ файлы в основном согласованы; soft suppliers / order orchestrator / DecimalInput / cookie auth совпадают с ROADMAP; нет живых SHA в wiki.

**Исправлено в этом проходе:**
- дыры vs ROADMAP «готово»: добавлены `concepts/qbl-soft-block`, `concepts/tech-maps-series-planning`;
- опечатка `Palavra-chave` в secrets-guard → `secret=…`;
- index: summary code-map; секция Analyses.

**Остаётся (не блокер):**
- нет отдельных entity-страниц: feedback/тикеты, production_register, ops-debug JSONL, login audit, changelog feed (упомянуты в ROADMAP/ops косвенно);
- `docs/STOCK_DOCUMENTS_SPEC.md` помечен v0.2 / старая ветка в шапке raw — канон поведения в коде новее (INV plan/fact); wiki concept актуален, raw-шапку не трогали (raw);
- ROADMAP «Обновлено: 2026-08-24» — дата шапки отстаёт от правки строки про wiki (косметика);
- analyses ещё без содержательных синтезов (кроме lint в log).

## [2026-08-26] query | Rules review + Karpathy gist fit

Проверка списка правил из Cursor Settings; анализ соответствия gist.  
Страница: `analyses/karpathy-gist-fit.md`. User rule docs sync — OK. Дубль блока LLM Wiki в UI = project rule (один файл); не копировать gist в User rules.

