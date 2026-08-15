# PROJECT_CONTEXT

## Ветка: main (эталон)

HTTPS на пилоте: **https://vilar-prod.ru**. SSH усилен (только ключ). Далее: бэкапы sqlite вне ВМ.

### На ВМ
- URL: https://vilar-prod.ru
- systemd: `vilar-op` + `nginx`
- SSH: `ubuntu_gertag` + ключ; см. шпаргалку `local/YANDEX_CLOUD.md` (не в git)
- Деплой: git bundle; фронт с `VITE_API_URL=https://vilar-prod.ru/api`
