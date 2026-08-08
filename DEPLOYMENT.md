# DEPLOYMENT

## Требования
- Node.js 20+ (в репозитории также можно использовать portable `.tools/node`)
- npm

## Первый запуск

```powershell
# Backend
cd backend
npm install
npm run seed
npm run dev
# API: http://localhost:3001

# Frontend (второй терминал)
cd frontend
npm install
npm run dev
# UI: http://localhost:5173
```

## Переменные
- `PORT` — порт API (по умолчанию 3001)
- `VITE_API_URL` — базовый URL API для фронта (по умолчанию `http://localhost:3001/api`)

## Данные
- JSON в `backend/data/*.json`
- Перегенерация: `npm run seed` в `backend` (перезаписывает демо-данные)
- Excel-выгрузка: `GET /api/export/{collection}.xlsx`

## Git
На машине разработки `git` может быть не в PATH; при наличии Git:
```powershell
git checkout -b feature/initial-ops-planning
```
