# D005 — единый DecimalInput

**Решение:** все числовые поля фронта через `DecimalInput`; запрет возврата к `type="number"` в формах документов/CRUD.

**Почему:** единообразие, locale `,`/`.`, старт с `0`, меньше потери строк INV/факта.

**Связано:** [entities/decimal-input.md](../entities/decimal-input.md)
