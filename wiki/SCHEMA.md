# Wiki SCHEMA — Vilar OP

Как агент ведёт знания проекта. Паттерн: [LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f). Поведение кода: `.cursor/rules/karpathy-guidelines.mdc`.

## Слои

| Слой | Где | Кто пишет |
|------|-----|-----------|
| **Raw** | `raw/` + канон в `docs/*.md` (методики, спеки) | Человек; агент **не** правит |
| **Wiki** | `wiki/**` | Агент (человек читает / правит pins) |
| **Schema** | этот файл + `.cursor/rules/wiki-schema.mdc` | Совместно |
| **Private raw** | `local/`, env на ВМ, sqlite | Только человек; **не в git, не в wiki** |

Секреты: [ops/secrets-and-local.md](ops/secrets-and-local.md), правило `.cursor/rules/secrets-guard.mdc`, проверка `npm run wiki:secrets-lint`.  
Правила Cursor vs docs: [concepts/rules-and-docs-lifecycle.md](concepts/rules-and-docs-lifecycle.md).

## Структура wiki/

```
wiki/
  SCHEMA.md       — этот файл
  index.md        — каталог страниц (читать первым)
  log.md          — append-only хронология
  overview.md     — снимок продукта
  concepts/       — доменные правила и понятия
  entities/       — сущности системы / API / код
  decisions/      — ADR-lite (почему так)
  ops/            — деплой, пилот, ИБ
  sources/        — саммари на raw (не копии)
  analyses/       — синтез из query (по мере надобности)
```

## Операции

### Ingest

1. Прочитать источник (raw или `docs/…`).
2. Обсудить/зафиксировать takeaways (кратко).
3. Создать/обновить `sources/<slug>.md`.
4. Обновить связанные `concepts/`, `entities/`, `decisions/`, `ops/`.
5. Обновить `index.md`.
6. Append в `log.md`: `## [YYYY-MM-DD] ingest | Title`.

Один источник за раз предпочтительнее batch без ревью.  
**Запрет:** не переносить пароли, ключи, содержимое `local/` в wiki.

### Query

1. Открыть `index.md` → выбрать 1–5 страниц.
2. Ответить со ссылками на wiki/raw.
3. Ценный синтез → новая страница (`analyses/` или `decisions/`) + запись в `log.md`: `query | …`.

### Lint

По запросу «проверь вики» / раз в спринт:

- противоречия между страницами;
- stale vs `docs/ROADMAP.md` / код;
- сироты без входящих ссылок;
- понятия без своей страницы;
- живые значения (SHA, «сейчас на main») в прозе — заменить ссылкой на файл;
- утечки секретов в wiki (если есть — удалить и сообщить).

## Триггеры актуализации (жизненный цикл)

Вики не обновляется сама по таймеру. Агент **обязан** обновить её при:

| Событие | Минимум |
|---------|---------|
| Merge / значимые изменения, уходящие в `main` | Затронутые pages + index + log |
| Смена поведения продукта | concepts/entities + при необходимости userGuide |
| Новое архитектурное «почему» | `decisions/Dnnn-…` + log |
| Ingest raw | sources + linked pages + log |
| Полезный ответ-синтез | analyses или decision + log |
| Релиз | CHANGELOG для людей; ops wiki при смене деплоя |

Пропуск wiki при изменении домена = тот же класс ошибки, что устаревший ROADMAP.

## Соглашения

- Язык страниц: **русский** (как проект).
- Ссылки: относительные markdown `[текст](path.md)`.
- Frontmatter опционален: `type`, `updated`, `sources`.
- **Не копировать** формулы/таблицы из raw целиком — краткий смысл + ссылка на канон.
- **Не дублировать** «текущее» состояние ветки: для git — `BRANCH_INFO.md` / `PROJECT_CONTEXT.md`.
- Human pin: если человек поправил claim, пометить `<!-- pin: ... -->` и не затирать при re-ingest без явного решения.
- После merge фичи в `main`: как в `.cursor/rules/docs-sync-after-main.mdc` **плюс** затронутые wiki-страницы + строка в `log.md`.

## Целевое состояние старых MD (не «удалить всё»)

| Остаётся каноном для людей / процесса | Ужимается (правда в wiki) | Никогда не в wiki |
|--------------------------------------|---------------------------|-------------------|
| Методики `docs/*`, CHANGELOG, ROADMAP, README, DEPLOYMENT, BRANCH_INFO | AGENT_BRIEF, PROJECT_CONTEXT (тонкие указатели) | `local/`, пароли, sqlite, auth_secret |

Dual-write на переходный период: домен можно кратко упомянуть в brief **со ссылкой** на wiki; не вести два полных текста. Подробности: [rules-and-docs-lifecycle](concepts/rules-and-docs-lifecycle.md).
