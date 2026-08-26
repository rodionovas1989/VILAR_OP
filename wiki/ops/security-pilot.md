# Ops: безопасность пилота (саммари)

**Канон:** [docs/SECURITY_PUBLIC_VM.md](../../docs/SECURITY_PUBLIC_VM.md), [docs/HTTPS_SETUP.md](../../docs/HTTPS_SETUP.md).

## Сделано на пилоте

HTTPS (vilar-prod.ru), API за nginx, cookie-сессия + RBAC, rate limit login, Helmet, SSH key-only, Admin без подсказок пароля в UI, EnvironmentFile для секретов на ВМ.

## Остаётся важным

- Бэкап sqlite **вне** ВМ (кнопка «Скачать» + регламент).
- Сильный пароль Admin; не светить в git/wiki.
- Этап C: патчи ОС, инцидент (ротация `AUTH_SECRET` / паролей).

## Секреты

Значения — только `local/` / EnvironmentFile / data на диске. Wiki: [secrets-and-local.md](secrets-and-local.md).
