# Анализ: RES split + Pull list staging (G13)

Статус: синтез query / decision. Обновлено: **2026-11-04**.  
Канон реализации: [docs/plans/reservation-pull-list-staging.md](../../docs/plans/reservation-pull-list-staging.md).  
ADR: [D015](../decisions/D015-reservation-pull-list-staging.md).

---

## Смысл

При складах Сырьё / Производство / ГП резерв появляется **сразу при создании заказа** (FEFO). Часть ног RES может лежать на Сырье, часть — уже на Производстве. Дыру на складе отпуска закрывает **Pull list** (дух SAP MF60 / material staging): перемещение + **переназначение RES**. Списание в производство (**PRI**) — только со склада **Производство**. Отдельный статус «обеспечен» не нужен: готовность = `stageGap = 0`.

Производство как склад = **staging**, не регистр НЗП ([wip-derived-from-orders](wip-derived-from-orders.md)).

---

## Соответствие SAP

| SAP | Vilar G13 |
|-----|-----------|
| Dependent reservation (RESB) при create | Early RES + партии (FEFO) |
| Issue storage location / PSA | `issueWarehouseId` = Производство |
| Pull list / staging (MF60) | Сущность Pull list → TRN + reassign RES |
| Available / missing parts | `stageGap` vs `enterpriseShortage` |
| TECO снимает открытые резервы | Завершение / отмена: fulfill/cancel хвостов RES |
| Приоритет pull list | Только сортировка UX стола ([WP11](warehouse-desktop.md)), не отдельный движок |

Нюанс: в классическом SAP RESB часто сразу на issue SLoc, а staging только двигает qty. У нас split RES по фактическим складам + reassign — тот же конечный инвариант, удобнее для FEFO/мультисклада ([D010](../decisions/D010-same-lot-multi-warehouse.md)).

---

## Reservation enforcement (SAP-like)

Не чекбокс «игнор резервов», а настройка **`reservationEnforcement`**: `strict` | `warn` (как Warning/Error availability check).

- Резервы всегда в available; меняется только реакция на конфликт.
- `warn` + проведение: обязательные ack + причина → `reservation_conflict_audit`.
- Вне политики: Pull list своего заказа; свой PRI (G2b); PRI не с issue WH — всегда hard.

Детали: канон-план §4.5.

## Волны (кратко)

- **a** — issue WH + freeQty-guards + **enforcement** + PRI only Production  
- **b** — early RES + split; адаптация стола планирования  
- **c** — Pull list  
- **d** — WP11 полный стол ([warehouse-desktop](warehouse-desktop.md) волна 5 = очередь Pull list), reverse pull list, частичное обеспечение (later)

---

## Связано

[sap-mm-pp-comparison](sap-mm-pp-comparison.md), [order-status-machine](../concepts/order-status-machine.md), [reservation-res](../entities/reservation-res.md), G2b [tech-maps-pp-pi-phases](../../docs/plans/tech-maps-pp-pi-phases.md), Q10.
