# Concept: техкарты и планирование серий

- **Сейчас (пилот):** техкарта (`tech_maps`) ≈ имя + `workCenterId`; этапов нет.
- **Плановые объёмы серий:** сейчас `materialId + workCenterId → quantity`; **цель G2b:** только `materialId → quantity` (РЦ убрать).
- **Планирование серий:** объём на период → массовые заказы `новый` (`POST /api/planning/plan-series`). Серии с заказом кроме `отменен` не попадают в подбор/`planSeries`.
- Отчёт **План/Факт** — `PlanFactReportPage`.
- **Цель G2b (есть план):** PP-PI операции/фазы, allocation в спеке, закрытие фазы→PRI, финал→PRR; [plan](../../docs/plans/tech-maps-pp-pi-phases.md), [sap-routing-operations](../analyses/sap-routing-operations.md).

**Связано:** [entities/production-order.md](../entities/production-order.md), [order-status-machine.md](order-status-machine.md)
