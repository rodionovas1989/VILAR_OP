# PROJECT_CONTEXT

## Ветка: fix/http-randomuuid-fallback (активна)

Баг ВМ: «Создать» документ молча не открывает форму на `http://IP` — `crypto.randomUUID()` только в secure context (HTTPS/localhost). Фикс: `frontend/src/utils/id.ts` (`newId`).

Релизы: локальная ветка → main → ВМ (`.cursor/rules/releases-and-updates.mdc`).

### На ВМ
- URL: http://51.250.73.169:3001
- systemd: `vilar-op`
- Код: ветка `main` (деплой через `git bundle` с ПК, т.к. репо private)
- Учётки: `local/CREDENTIALS.md` (не в git)
- Бэкап перед деплоем: `~/backups/vilar-pre-deploy-*.sqlite`

### Локально (не в git)
- `local/YANDEX_CLOUD.md`, `local/CREDENTIALS.md`, `local/deploy-vm.sh`
