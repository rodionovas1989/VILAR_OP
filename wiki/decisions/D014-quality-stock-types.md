# D014 — типы остатка качества (QI / Blocked)

**Решение:** карантин и блокировка отражаются **количествами типов остатка** на складе (SAP IM-like). Параллельный справочник «Качества партий» / QCM / `quality_register` **снимаем** (дублируют типы остатка; заказчик механизм не использовал).

1. На ключе материал × партия × склад — три qty: **unrestricted**, **QI**, **blocked**.
2. К резерву / отпуску / отгрузке / FEFO — только **unrestricted** (минус RES).
3. Смена типа / места — **только** документы с проводками (**STT**, TRN, RCP…). Сторно — [D013](D013-storno-new-document.md) / R10.
4. **Сценарии** = автопоследовательность **тех же** документов, что сделал бы человек; **запрещены** скрытые проводки. Канон: [quality-scenarios-movements](../concepts/quality-scenarios-movements.md).
5. Причины на движении — единый справочник **причин движения** (дух SAP `GRUND`), допустимость/обязательность по типу документа (STT/TRN/…).
6. **LCH** — что измерять и факты на партии (дух batch classification). Допуски/spec limits — отдельная заметка ROADMAP (**Q12**), пока не связываем со сценариями.
7. Полноценный отбор проб (сущность пробы) — ROADMAP **Q13**, не Q10. Разбор: [sap-physical-samples](../analyses/sap-physical-samples.md).
8. Полный inspection lot — идея **Q11**, не v1 Q10.

**Q9:** после Q10 резерв из QI/Blocked невозможен моделью; пункт закрыть при merge.

**Архитектурные defaults (RES∩STT, INV, TRN, RCP stockType, фазы cutover):** таблица A–J в плане — не дублировать здесь.

**Канон:** [docs/plans/quality-stock-types.md](../../docs/plans/quality-stock-types.md).  
**Разбор:** [analyses/quality-stock-types.md](../analyses/quality-stock-types.md).
