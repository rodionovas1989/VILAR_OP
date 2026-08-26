# Entity: RES (резервирование)

Документ `reservation` / коллекция `reservation_documents`.

- Создаётся при подтверждении подбора сырья (`confirmMaterialPicks`).
- Posted → строки в `active_reservations`; stock не уменьшает.
- Переплан: старый RES cancelled, новый posted.
- Complete: RES → fulfilled.

**Связано:** [concepts/order-status-machine.md](../concepts/order-status-machine.md), [pri-prr-complete.md](pri-prr-complete.md)
