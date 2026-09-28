# Entity: DecimalInput

Единый числовой ввод во фронтовых формах (`DecimalInput` + `decimalInput.ts`):

- можно начинать с `0`;
- `,` / `.`;
- невалидные символы блокируются с подсказкой;
- не использовать `input type="number"` в документах/CRUD.

**Показ qty:** `frontend/src/utils/qty.ts` — `roundQty` / хранение = 6; `formatQty(n, decimals?)` для UI. Масштаб отображения — `qtyDisplayDecimals` в [модели учёта](accounting-models.md) (не влияет на ввод).

**Decision:** [decisions/D005-decimal-input.md](../decisions/D005-decimal-input.md)
