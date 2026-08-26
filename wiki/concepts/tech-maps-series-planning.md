# Concept: техкарты и планирование серий

- **Техкарта** (`tech_maps`): имя + `workCenterId`.
- **Плановые объёмы серий:** срез `materialId + workCenterId → quantity`; при создании заказа количество подставляется (можно править).
- **Планирование серий:** объём на период → массовые заказы со статусом `новый` (`POST /api/planning/plan-series`).
- Отчёт **План/Факт** производства — UI `PlanFactReportPage`.

**Связано:** [entities/production-order.md](../entities/production-order.md), [order-status-machine.md](order-status-machine.md)
