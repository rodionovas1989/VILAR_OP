# DEPLOYMENT

## Требования
- Node.js 20+ (портативный `.tools/node` или системный)
- npm

## Для пользователя (Windows, без командной строки)

Только ASCII-имена (кириллические `.bat` удалены — ломают `cmd.exe`):

1. `install.bat` — один раз
2. `start-all.bat` — каждый рабочий день  
   Либо: `start-backend.bat` + `start-frontend.bat`

- API: http://localhost:3001  
- UI: http://localhost:5173  

Скрипты: `scripts/install.ps1`, `scripts/start-backend.ps1`, `scripts/start-frontend.ps1`.

## Из корня репозитория

```powershell
npm run setup       # зависимости + демо-данные
npm run backend     # Express API (watch)
npm run frontend    # Vite UI
```

## Классический запуск

```powershell
cd backend
npm install
npm run seed
npm run dev
# API: http://localhost:3001

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
- Перегенерация: `npm run backend:seed` из корня или `npm run seed` в `backend`
- После обновления спецификаций (регистрация поставщиков) для демо-данных удобно пересидить; иначе заполните вкладку «Регистрация поставщиков» вручную
- Excel-выгрузка одной коллекции: `GET /api/export/{collection}.xlsx`
- Экспорт выбранных справочников: `POST /api/admin/export-dictionaries.xlsx` (тело `{ "collections": ["materials", ...] }`)

## Git
```powershell
git checkout feature/planning-orders-matrix
```
