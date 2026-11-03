# Concept: складские документы post/cancel/repost

Каждый тип — отдельная коллекция и вкладка. Общий жизненный цикл: нумерация, статусы, `post` / `cancel` / `fulfill`.

Коды: RCP, TRN, INV, WOF, PST, RES, PRI, PRR, SHP.

Особые случаи:

- **RES** — не меняет `stock`, только активные резервы.
- **INV** — не меняет `stock` при проведении; создаёт черновики WOF/PST по дельте.

**Целевой канон сторно (R10, план):** для документов, двигающих stock, отмена ≠ soft-cancel строк того же id. Создаётся **новый документ-сторно B** (черновик → провести), ссылка на A; A → `reversed`. См. [D013](../decisions/D013-storno-new-document.md), [storno-stock-documents](../analyses/storno-stock-documents.md). Сейчас в коде ещё legacy `reverseStockMovements`.

**Канон:** [docs/STOCK_DOCUMENTS_SPEC.md](../docs/STOCK_DOCUMENTS_SPEC.md)  
**Связано:** [entities/stock-registers.md](../entities/stock-registers.md), [inv-plan-fact-wof-pst.md](inv-plan-fact-wof-pst.md)
