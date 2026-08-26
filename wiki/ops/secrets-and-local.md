# Ops: секреты и `local/`

## Где живут секреты (вне wiki и вне git)

| Что | Где | В git? |
|-----|-----|--------|
| SSH / IP / шпаргалки пилота | папка `local/` | **нет** (`.gitignore`) |
| `VILAR_ADMIN_PASSWORD`, unit secrets | EnvironmentFile на ВМ | **нет** |
| `AUTH_SECRET` | env или `backend/data/auth_secret` | **нет** |
| Боевая sqlite | `backend/data/*.sqlite`, бэкапы | **нет** |
| `.env` / `.env.local` | корень / backend | **нет** |

Канон имён переменных (без значений): [DEPLOYMENT.md](../../DEPLOYMENT.md). ИБ: [security-pilot.md](security-pilot.md).

## Профилактика (главное)

Правило агента: `.cursor/rules/secrets-guard.mdc`.

1. Не читать `local/` ради wiki; при необходимости деплоя — в wiki только путь к файлу.
2. Секрет в чате → в файлы не копировать; в ответе `***`.
3. Перед commit — не стейджить secret-пути.
4. Перед push wiki-изменений: `npm run wiki:secrets-lint`.

## Если утечка всё же случилась

Вычистить файл(ы) → ротировать секрет → не коммитить утечку (если уже в remote — сказать пользователю явно).

## Политика LLM Wiki

Wiki/raw в репо: процедуры и **имена** переменных, никогда значения. Private raw = `local/` + env на ВМ.
