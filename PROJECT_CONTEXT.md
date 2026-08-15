# PROJECT_CONTEXT

## Ветка: feature/login-rate-limit (активна)

Rate limit на `POST /api/auth/login` (по IP и логину, in-memory). HTTPS — следующий шаг.
См. `docs/SECURITY_PUBLIC_VM.md`, env: `LOGIN_RATE_MAX`, `LOGIN_RATE_WINDOW_MS`, `TRUST_PROXY`.

Релизы: локальная ветка → main → ВМ (`.cursor/rules/releases-and-updates.mdc`).

### На ВМ
- URL: http://51.250.73.169:3001
- systemd: `vilar-op`
- Код: ветка `main` (деплой через `git bundle` с ПК)
- Учётки: `local/CREDENTIALS.md` (не в git)
