# Entity: PRI + PRR при completeOrder

Завершение заказа (`POST /api/planning/complete/:id`) в одной транзакции:

- **PRI** — списание сырья в производство; **по одному документу на каждый склад** строк факта (`warehouseId` в `actualLines` → `warehouseFromId` шапки PRI);
- **PRR** — один выпуск ГП на склад выпуска (`warehouseToId`);
- все открытые **RES** заказа → fulfilled;
- заказ → `завершен`;
- снимок в регистр аналитики производства.

Повторный complete запрещён guard’ом.

Склад списания задаётся в строке факта на столе управления заказами (не один склад на весь заказ).

**Код:** `backend/src/services/planning.js`, `productionRegister.js`  
**Связано:** [reservation-res.md](reservation-res.md), [production-register.md](production-register.md)
