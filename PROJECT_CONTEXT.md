# PROJECT_CONTEXT

## Ветка: main (эталон)

HTTPS на пилоте: **https://vilar-prod.ru** (nginx + Let’s Encrypt).
Старый URL `:3001` снаружи закрыт. Далее: бэкапы вне ВМ, SSH hardening.

### На ВМ
- URL: https://vilar-prod.ru
- systemd: `vilar-op` + `nginx`
- CORS: `https://vilar-prod.ru`, TRUST_PROXY=1
- Деплой кода: git bundle; после деплоя фронт собирать с `VITE_API_URL=https://vilar-prod.ru/api`
