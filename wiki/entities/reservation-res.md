# Entity: RES (резервирование)

Документ `reservation` / коллекция `reservation_documents`.

- Создаётся при подтверждении подбора сырья (`confirmMaterialPicks`).
- **По одному RES на склад**: строки picks с `warehouseId` группируются; склад в шапке документа.
- Posted → строки в `active_reservations` (с тем же `warehouseId`); stock не уменьшает.
- Переплан: все открытые RES заказа cancelled, создаются новые.
- Complete: все posted RES заказа → fulfilled.

**Связано:** [concepts/order-status-machine.md](../concepts/order-status-machine.md), [pri-prr-complete.md](pri-prr-complete.md)
