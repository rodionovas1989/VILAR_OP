# D015 — Early RES, split по складам, Pull list, PRI с Производства

**Решение:** контур обеспечения сырья под заказ строится SAP-like (дух RESB + material staging / pull list), с фарм-уклоном (партия в резерве сразу).

1. **RES при создании заказа** (FEFO/FIFO), soft hold; не ждать отдельного статуса «обеспечен».
2. **Split** одной партии по складам разрешён (несколько ног RES) — целевая замена interim [D010](D010-same-lot-multi-warehouse.md) / G8.
3. У заказа обязателен **`issueWarehouseId`** (склад **Производство**). **PRI только с него** — без переходного «можно с Сырья».
4. Нехватка на issue WH при наличии на Сырье закрывается сущностью **Pull list**: TRN + **переназначение** RES на Производство. Свободный TRN зарезервированного — не «молча», а через политику enforcement.
5. Статус **«обеспечен» не вводим** (избыточен при early RES). На столах — вычисляемые **`stageGap`** и **`enterpriseShortage`**.
6. Склад Производство = **staging-буфер** до отпуска; **не** qty-НЗП ([wip-derived-from-orders](../analyses/wip-derived-from-orders.md), R9).
7. Приоритезация очереди staging — только UX стола (**WP11**), не отдельный движок.
8. **`reservationEnforcement`:** `strict` \| `warn` (дух SAP availability W/E). Default `strict`. Не «игнор резервов»: в `warn` — confirm + причина + audit; RES-механизм не отключается.

**Почему не RES только после подвоза:** иначе до обеспечения нет ATP-hold и FEFO на предприятии; shortage снабжения слепой.

**Почему не статус «обеспечен»:** при early RES «твёрдость» уже в резерве; готовность цеха = `stageGap = 0`, не ещё одна ручная кнопка.

**Почему не глобальный «Игнорировать резервы»:** как в SAP — меняют severity проверки, а не выключают RESB; иначе ATP и дисциплина staging разваливаются.

**Канон:** [docs/plans/reservation-pull-list-staging.md](../../docs/plans/reservation-pull-list-staging.md).  
**Разбор:** [analyses/reservation-pull-list-staging.md](../analyses/reservation-pull-list-staging.md).  
**Связано:** [D009](D009-multi-warehouse-pri.md), [D010](D010-same-lot-multi-warehouse.md), [D014](D014-quality-stock-types.md), G2b, Q10.
