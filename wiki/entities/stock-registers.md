# Entity: регистры запасов (read-mostly)

Коллекции вроде `stock`, `active_reservations`, движения, качество:

- через generic `/api/{name}` — **только GET**;
- запись — через `/api/documents/:type` и `/api/planning`.

Свободный остаток и склады — `backend/src/services/stock.js`.

**Связано:** [concepts/document-lifecycle.md](../concepts/document-lifecycle.md)
