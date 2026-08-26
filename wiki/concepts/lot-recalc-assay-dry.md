# Concept: qtyBasis per1000 и пересчёт assay/dry

Норма в спецификации: **кг на 1000 упаковок** (`qtyPerUnit`).  
План расхода: `need = qtyPerUnit * order.quantity / 1000`.

Метод **содержание и потеря при высушивании** (`assay_and_dry`):

- в формулу входят **только** характеристики из применения материала;
- эталон содержания — в строке спеки (по умолчанию 100 %);
- факт — регистр LCH; проценты как 95 и 2, не 0.95;
- нет факта → эталон / потеря 0 % + warning, резерв **не** стопается.

**Канон формул:** [docs/LOT_RECALC.md](../docs/LOT_RECALC.md)  
**Связано:** [entities/lch-characteristics.md](../entities/lch-characteristics.md), [entities/decimal-input.md](../entities/decimal-input.md)
