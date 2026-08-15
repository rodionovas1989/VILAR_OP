# Changelog

Все значимые изменения проекта фиксируются здесь. Формат близок к [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/).

## [0.2.0] — 2026-08-15

### Added
- Документ качества QBL («Блокировка партии»): причина, флаг на партии, красная подсветка в планировании (резерв пока разрешён).
- httpOnly cookie-сессии (`vilar_session`) + CORS credentials; Bearer оставлен на переходный период.
- Админ-страница «Что нового» (чтение `docs/CHANGELOG.md`).
- Простой общий чат в шапке (polling).
- Helmet на Express; сниппет заголовков nginx.
- Выбор складов списания/выпуска при завершении производства.

### Changed
- `resolveActorUserId` больше не подставляет Admin при отсутствии пользователя.
- Уникальность номера серии при create/update.

### Security
- Cookie: HttpOnly, SameSite=Lax, Secure на проде.

## [0.1.0] — 2026-08-14

### Added
- Пилот на https://vilar-prod.ru (nginx + Let’s Encrypt).
- Guest AuthGate, rate limit логина, журнал входов, бэкапы с выгрузкой на ПК.
