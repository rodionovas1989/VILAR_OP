# Ops: локальный запуск и пилот

## Локально (Windows)

- `install.bat` / `start-all.bat` / `restart-all.bat` / `backup.bat`
- API `:3001`, UI `:5173`; Node 22+
- Порты защищены `scripts/port-guard.ps1`
- Канон: [DEPLOYMENT.md](../../DEPLOYMENT.md)

## Пилот

- Домен / HTTPS: [docs/HTTPS_SETUP.md](../../docs/HTTPS_SETUP.md)
- ИБ ВМ: [docs/SECURITY_PUBLIC_VM.md](../../docs/SECURITY_PUBLIC_VM.md)
- Секреты Admin — EnvironmentFile на ВМ
- Бэкапы: админ UI + скачивание слепка на ПК; локально `backup.bat`
- Заметки IP/SSH — только в `local/` (не в git)

## Тесты

```bash
npm test
```

Изолированная sqlite; рабочие данные не трогает.
