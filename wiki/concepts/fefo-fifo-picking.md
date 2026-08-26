# Concept: FEFO / FIFO и годность

**FEFO** (по умолчанию для фармы) — раньше истекает срок → раньше в подбор.  
**FIFO** — раньше поступило / произведено → раньше в подбор.

Дополнительно:

- Истёкший срок — нельзя резервировать.
- Срок до конца производства — мягкое предупреждение.
- Учитывается **свободный** остаток: запас − активные резервы.
- **Пакетный подбор** нескольких заказов: общий виртуальный расход по ключу партия×склад (`suggestPicksBulk`). Если FEFO-партия «съедена» предыдущим заказом в пакете, следующий заказ получает **следующую** подходящую партию (GMP: без смешивания партий внутри одной серии).
- Approved suppliers: мягкий бейдж (зелёный/жёлтый), не жёсткий запрет — [soft-vs-hard-supplier-approval.md](soft-vs-hard-supplier-approval.md).
- Аналоги: прямой заменитель без транзитивности — [substitutions-no-transitivity.md](substitutions-no-transitivity.md).
- Мелкие «хвосты» партий, которые никогда не набирают need серии — анализ отложен: [lot-leftover-tails.md](../analyses/lot-leftover-tails.md).

**Канон:** [docs/GMP_SERIES_RULES.md](../docs/GMP_SERIES_RULES.md) §5  
**Код:** `backend/src/services/planning.js` (`suggestPicksForOrder`, `suggestPicksBulk`), `stock.js`
