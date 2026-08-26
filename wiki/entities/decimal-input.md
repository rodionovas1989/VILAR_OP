# Entity: DecimalInput

Единый числовой ввод во фронтовых формах (`DecimalInput` + `decimalInput.ts`):

- можно начинать с `0`;
- `,` / `.`;
- невалидные символы блокируются с подсказкой;
- не использовать `input type="number"` в документах/CRUD.

**Decision:** [decisions/D005-decimal-input.md](../decisions/D005-decimal-input.md)
