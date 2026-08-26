# Concept: машина статусов заказа

Статусы: `новый` → `спланирован` → `завершен` | `отменен`.

| Переход | Условие | Эффект |
|---------|---------|--------|
| Подтвердить материалы | новый или спланирован (переплан) | RES posted → `спланирован` |
| Факт | только спланирован | actualQuantity / actualLines |
| Завершить | только спланирован | PRI+PRR posted, RES fulfilled → `завершен` |
| Отменить | новый или спланирован | RES cancelled → `отменен` |
| Повторное завершение / отмена завершённого | **запрещено** | guards |

Подбор на вкладке 1 — только из `новый`, статус не меняет.

**Канон:** [docs/ORDER_STATUS_GUARDS.md](../docs/ORDER_STATUS_GUARDS.md)  
**Связано:** [entities/production-order.md](../entities/production-order.md), [entities/reservation-res.md](../entities/reservation-res.md), [entities/pri-prr-complete.md](../entities/pri-prr-complete.md)
