# Entity: заказ на производство

Единая сущность планирования. Отдельного «плана производства» нет.

- Оркестрирует RES / факт / complete; сам по себе не движение запасов.
- UI: `ProductionOrderPage`, рабочий стол, `ProductionDesktop`.
- Плановые объёмы серий: срез materialId + workCenterId → quantity (подстановка при создании).

**Связано:** [concepts/order-status-machine.md](../concepts/order-status-machine.md)  
**API:** CRUD коллекция заказов + `/api/planning/*`
