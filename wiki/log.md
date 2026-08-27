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

## [2026-08-26] ingest | Lint follow-up entities

Закрыт хвост lint: `feedback-tickets`, `production-register`, `ops-debug`, `login-audit`, `changelog-feed`.  
Пункт «Остаётся» из lint-2026-08-26 по этим entity снят.

## [2026-08-26] ingest | Merged docs/llm-wiki → main

Fast-forward в `main`, push `origin/main`. Wiki и rules — эталон на main.

## [2026-08-26] ingest | Multi-warehouse PRI/RES (D009)

Склад списания в строках заказа/факта; N RES при confirm; N PRI при complete; стол производства — колонка склада. Подбор лотов отдаёт пары партия×склад.

## [2026-08-26] decision | D010 same lot / multi-warehouse

Зафиксированы варианты A–D (авто-аллокация, TRN, ручной split, логический склад).  
**Сейчас:** консолидация остатка партии через **TRN** до резерва; авто-сплит одной партии по складам не делаем.  
Страницы: `decisions/D010-same-lot-multi-warehouse`, правки `gmp-one-lot-per-component`, ссылка из D009.

## [2026-08-26] ingest | Merged feature/multi-warehouse-pri-res → main

Мультисклад в `main`: UI подбора/факта (номер партии + колонки склад/свободно), N RES/PRI, тест chain, userGuide/CHANGELOG, D009/D010.

## [2026-08-26] ingest | Iterative bulk pick + problem filter

`suggestPicksBulk` с виртуальным claimed партия×склад; UI: фильтр «Только проблемные» по заказам (✗ или предупреждения); кнопка «Следующая проблема» убрана.

## [2026-08-26] fix | Подбор сырья: индекс фильтра и подписи партий

Исправлено: смена партии при «Только проблемные» по `orderId` (не по индексу в отфильтрованном списке); в колонке «Партия» только номер (без склада/свободно и без UUID); текст ошибки под материалом.

## [2026-08-26] ingest | G9 хвосты партий

Модалка «Хвосты партий» + `POST /planning/lot-leftover-tails`; ROADMAP G9 → готово; analysis обновлён.

## [2026-08-27] fix | SearchableSelect label match (FB-2026-08-27-00001)

Поиск только по label: короткий запрос — prefix; mid-includes с 3 символов; UUID value не участвует.

## [2026-08-27] ingest | Modal scroll + Clinical Ops UI kit

Скролл LCH/QCM: `.doc-form-scroll`; CSS fallback без scroll-child; wiki `concepts/ui-scroll-layout`.  
UI kit: токены `--radius-*` / `--ctrl-*` / denser tables, `.ctrl` + `ctrl-like` Select, wiki `concepts/ui-kit`.

## [2026-08-27] fix | Quality desktop UX + ToggleSwitch

Отборы производитель/даты; ТЧ партий — только номер; инфо «?» с реквизитами/значениями/историей; оба режима тогла — ввод LCH; фикс сброса черновика; компонент `ToggleSwitch` для настроек.


