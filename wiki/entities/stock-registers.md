# Entity: регистры запасов (read-mostly)

Коллекции вроде `stock`, `active_reservations`, движения, качество:

- через generic `/api/{name}` — **только GET**;
- запись — через `/api/documents/:type` и `/api/planning`.

Свободный остаток и склады — `backend/src/services/stock.js` (сейчас одно `quantity`).

Журнал дельт для расследования — отчёт «Движения запасов» (`stockMovementReport.js`), не экран «Запасы (ист)».

**План R10:** на движениях — учётный `postingDate` (срезы «на дату»); сторно даёт **отдельный** документ и свои строки журнала, исходные не выкидывать из наката. См. [storno-stock-documents](../analyses/storno-stock-documents.md), STOR1.

**План Q10:** три qty (unrestricted / QI / blocked); `freeQty` только unrestricted − RES; перекладка типа — документ **STT**. См. [quality-stock-types](../analyses/quality-stock-types.md), [D014](../decisions/D014-quality-stock-types.md); согласовать схему со STOR1.

**Связано:** [concepts/document-lifecycle.md](../concepts/document-lifecycle.md)
