# PROJECT_CONTEXT

## Ветка: feature/roadmap-batch-remaining

Батч ROADMAP волнами:
1. actor без Admin-fallback; уникальность серии; Helmet; склады в completeOrder
2. QBL блокировка партии + красная подсветка в планировании
3. httpOnly cookie-сессии (`vilar_session`) + CORS credentials
4. changelog в Админке + простой чат в шапке

Пилот: https://vilar-prod.ru. После merge в `main` — деплой на ВМ (CORS_ORIGIN, TRUST_PROXY, COOKIE_SECURE).
