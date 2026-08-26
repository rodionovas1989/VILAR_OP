# Concept: FEFO / FIFO и годность

**FEFO** (по умолчанию для фармы) — раньше истекает срок → раньше в подбор.  
**FIFO** — раньше поступило / произведено → раньше в подбор.

Дополнительно:

- Истёкший срок — нельзя резервировать.
- Срок до конца производства — мягкое предупреждение.
- Учитывается **свободный** остаток: запас − активные резервы.
- Approved suppliers: мягкий бейдж (зелёный/жёлтый), не жёсткий запрет — [soft-vs-hard-supplier-approval.md](soft-vs-hard-supplier-approval.md).
- Аналоги: прямой заменитель без транзитивности — [substitutions-no-transitivity.md](substitutions-no-transitivity.md).

**Канон:** [docs/GMP_SERIES_RULES.md](../docs/GMP_SERIES_RULES.md) §5  
**Код:** `backend/src/services/planning.js`, `stock.js`
