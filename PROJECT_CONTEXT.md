# PROJECT_CONTEXT

## Ветка: main (эталон после релиза)

Слито: `feature/auth-gate-landing` — гости видят только «Вход»; после login — полный UI.
Риски/план публичной ВМ: `docs/SECURITY_PUBLIC_VM.md`.

Релизы: локальная ветка → main → ВМ (`.cursor/rules/releases-and-updates.mdc`).

### На ВМ
- URL: http://51.250.73.169:3001
- systemd: `vilar-op`
- Код: ветка `main` (деплой через `git bundle` с ПК, т.к. репо private)
- Учётки: `local/CREDENTIALS.md` (не в git)
- Бэкап перед деплоем: `~/backups/vilar-pre-deploy-*.sqlite`

### Локально (не в git)
- `local/YANDEX_CLOUD.md`, `local/CREDENTIALS.md`, `local/deploy-vm.sh`
