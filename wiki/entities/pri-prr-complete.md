# Entity: PRI + PRR при completeOrder

Завершение заказа (`POST /api/planning/complete/:id`) в одной транзакции:

- **PRI** — списание сырья в производство;
- **PRR** — выпуск ГП;
- RES → fulfilled;
- заказ → `завершен`;
- снимок в регистр аналитики производства.

Повторный complete запрещён guard’ом.

**Код:** `backend/src/services/planning.js`, `productionRegister.js`
