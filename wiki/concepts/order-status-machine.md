# Concept: машина статусов заказа

Статусы (канон G2b + текущий код): `новый` → `спланирован` → (**`в работе`** после G2b-b) → `завершен` | `отменен`.

**Статус «обеспечен» не вводим** ([D015](../decisions/D015-reservation-pull-list-staging.md) / G13): при early RES готовность цеха = вычисляемый **`stageGap`**, дефицит предприятия = **`enterpriseShortage`**.

| Переход | Условие (сейчас / цель) | Эффект |
|---------|-------------------------|--------|
| Подтвердить материалы | новый или спланирован (переплан) | RES posted → `спланирован` (**сейчас**). **G13-b:** RES уже при create; confirm → переплан / deprecate |
| Факт | только спланирован | actualQuantity / actualLines |
| В работу (G2b-b) | спланирован + снимок маршрута | фазы open; PRI по закрытию |
| Завершить | спланирован (сейчас) / все фазы + PRR (G2b) | PRI+PRR, RES fulfilled → `завершен` |
| Отменить | новый или спланирован (не в работе без сторно) | RES cancelled → `отменен` |
| Повторное завершение / отмена завершённого | **запрещено** | guards |

Подбор на вкладке 1 — только из `новый`, статус не меняет (до смены модели G13-b).

История смен статуса заказа сейчас **не** пишется (только поле на карточке). План **A3c:** [order-status-history](../../docs/plans/order-status-history.md). Складские док-ты — отдельно **A3b**.

**Канон:** [docs/ORDER_STATUS_GUARDS.md](../../docs/ORDER_STATUS_GUARDS.md)  
**Связано:** [entities/production-order.md](../entities/production-order.md), [entities/reservation-res.md](../entities/reservation-res.md), [entities/pri-prr-complete.md](../entities/pri-prr-complete.md), [G13](../../docs/plans/reservation-pull-list-staging.md)
