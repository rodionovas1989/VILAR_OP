# PROJECT_CONTEXT

## Ветка: main

Ревью 2026-08-15: обновлены `docs/ROADMAP.md`, canvas-ревью. Пилот HTTPS + SSH harden.
Следующее по ИБ/эксплуатации: **бэкап sqlite вне ВМ**.

### На ВМ
- URL: https://vilar-prod.ru
- SSH: только ключ (`local/YANDEX_CLOUD.md`)
- Деплой: git bundle + `VITE_API_URL=https://vilar-prod.ru/api`
