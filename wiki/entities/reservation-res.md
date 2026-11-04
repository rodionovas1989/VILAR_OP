# Entity: RES (резервирование)

Документ `reservation` / коллекция `reservation_documents`. Soft hold: **stock не уменьшает**; строки в `active_reservations`.

## Сейчас (код)

- Создаётся при подтверждении подбора сырья (`confirmMaterialPicks`).
- **По одному RES на склад**: строки picks с `warehouseId` группируются; склад в шапке документа.
- Переплан: все открытые RES заказа cancelled, создаются новые.
- Complete: все posted RES заказа → fulfilled.

## Цель G13 ([D015](../decisions/D015-reservation-pull-list-staging.md))

- **Early RES** при создании заказа / plan-series (FEFO).
- **Split** одной партии по складам (несколько ног / N RES) — см. [D010](../decisions/D010-same-lot-multi-warehouse.md).
- **Pull list:** TRN + **reassign** `warehouseId` RES на `issueWarehouseId` (Производство).
- Свободный TRN reserved qty запрещён; PRI гасит reserved на issue WH (withdrawn — G2b).

**Канон:** [docs/plans/reservation-pull-list-staging.md](../../docs/plans/reservation-pull-list-staging.md).  
**Связано:** [concepts/order-status-machine.md](../concepts/order-status-machine.md), [pri-prr-complete.md](pri-prr-complete.md), [D009](../decisions/D009-multi-warehouse-pri.md)
