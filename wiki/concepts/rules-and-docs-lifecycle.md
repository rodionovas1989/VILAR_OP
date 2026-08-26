# Concept: слои правил Cursor и конец dual-write

## Иерархия правил (после перехода)

| Слой | Где | Назначение | Судьба |
|------|-----|------------|--------|
| **User (глобальные) Cursor** | Settings → Rules / User rules | Стиль общения, git safety, PR, дизайн — **на все проекты** | Оставить; убрать из них только то, что уникально для Vilar |
| **Project alwaysApply** | `.cursor/rules/*.mdc` | Vilar: wiki, karpathy coding, sync после main, релизы/ВМ | Источник истины по проекту |
| **Wiki SCHEMA** | `wiki/SCHEMA.md` | Как вести знания | Эволюция вместе с вики |
| **User rule «обновлять md»** | user rules | README/CONTEXT/… | Согласовать с wiki sync (см. ниже) — не дублировать длинные списки |

**Не дублировать** одно и то же в user rules и project rules: глобальное — коротко и общее; Vilar-специфика — только в `.cursor/rules/` + wiki.

### Рекомендация по текущим User rules (Cursor → Rules)

| Блок | Вердикт |
|------|---------|
| Git commit protocol | **оставить** — кросс-проект |
| Creating pull requests / `gh` | **оставить** |
| Frontend design hard rules | **оставить** (если пишете UI не только здесь) |
| Communication (concise, bold sparingly) | **оставить** |
| «Обновлять README, PROJECT_CONTEXT, DEPLOYMENT, AGENT_BRIEF, BRANCH_INFO» + «фичи в новых ветках» | **подправить**, не удалять целиком |

Текст user rule про docs заменить на что-то вроде:

```
- Новые фичи — только в новых ветках
- После изменений в Vilar_OP: следовать `.cursor/rules/docs-sync-after-main.mdc`
  (корневые md по смыслу + wiki/ + wiki/log.md). Не дублировать энциклопедию в AGENT_BRIEF.
```

Так список файлов живёт в проекте (и эволюционирует с wiki), а не устаревает в глобальных rules.

Старые project rules (`docs-sync-after-main`, `releases-and-updates`) **не выкидывать** — влить wiki в их чеклисты (уже сделано). Плюс `secrets-guard.mdc`.

## Целевое состояние старых MD

| Файл | Навсегда? | Роль после перехода |
|------|-----------|---------------------|
| `docs/GMP_*`, `LOT_RECALC`, `ORDER_STATUS_*`, `STOCK_*`, `LEGAL_*`, `SECURITY_*`, `HTTPS_*` | **да** | Raw-методики / спеки; wiki только саммари |
| `docs/CHANGELOG.md` | **да** | Лента для людей в UI |
| `docs/ROADMAP.md` | **да** | План vs факт (человек+агент) |
| `README.md`, `DEPLOYMENT.md` | **да** | Люди, установка, env **имена** |
| `BRANCH_INFO.md` | **да** | Операционная таблица веток |
| `PROJECT_CONTEXT.md` | **да, тонкий** | 5–15 строк: ветка + 1 абзац; детали → wiki/log |
| `AGENT_BRIEF.md` | **да, тонкий** | Навигация + сжатая карта API/файлов; энциклопедия → wiki |
| Энциклопедические куски в brief | **нет** | Уезжают в `wiki/concepts|entities` и больше не ведутся в brief |

«Перестанут вестись» = **перестанут быть вторым местом правды** для домена/решений, а не «удалим все md».

## Самоактуализация вики (жизненный цикл)

Вики **не** обновляется магически в фоне. Актуализация = **обязательные триггеры** в правилах агента:

| Триггер | Действие |
|---------|----------|
| Merge / значимый commit в `main` | Обновить затронутые wiki-страницы + `index` + `log` (как docs-sync) |
| Закрытие/слияние ветки | Строка в `BRANCH_INFO` + при необходимости decision/entity |
| Ingest нового raw / заметки заказчика | sources + concepts + log |
| Query с ценным синтезом | analyses/decisions + log |
| Релиз / тег | CHANGELOG (люди) + при необходимости ops wiki |
| По просьбе / раз в спринт | **lint** вики |

Если агент менял поведение продукта и не тронул wiki — это нарушение schema (то же, что забыть ROADMAP).
