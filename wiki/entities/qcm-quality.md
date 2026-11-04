# Entity: качество QCM (к снятию)

**Статус:** текущий код ещё содержит QCM / `lot_qualities` / `quality_register`.  
**Цель Q10:** **полный снос** — дублируют типы остатка; заказчик не использовал. Решение о доступности = **STT** (+ причины движения); факты = **LCH**.

Исторически: единый документ качества; сценарии `onLotCreated` → авто-QCM.  
После Q10 сценарии → документы остатков: [quality-scenarios-movements](../concepts/quality-scenarios-movements.md).

**Канон:** [D014](../decisions/D014-quality-stock-types.md), [quality-stock-types](../analyses/quality-stock-types.md).  
**Идея lot:** [sap-inspection-lot](../analyses/sap-inspection-lot.md) (Q11).
