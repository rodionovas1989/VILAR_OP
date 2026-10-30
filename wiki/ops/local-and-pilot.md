# Ops: локальный запуск и пилот

## Локально (Windows)

- `install.bat` / `start-all.bat` / `restart-all.bat` / `backup.bat`
- API `:3001`, UI `http://127.0.0.1:5173` (Vite `host: 127.0.0.1`: на Windows `localhost` без этого часто только IPv6, браузер не открывает страницу); Node 22+
- В dev интерфейс ходит в API через относительный `/api` (прокси Vite). Cookie сессии на том же хосте, что и страница.
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
